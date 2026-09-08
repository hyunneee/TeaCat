package com.teacat.server.stadium.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.stadium.dto.response.ExcelCandidateResponse;
import com.teacat.server.stadium.dto.response.ExcelSheetResponse;
import com.teacat.server.stadium.exception.StadiumErrorCode;
import org.apache.poi.EncryptedDocumentException;
import org.apache.poi.openxml4j.exceptions.OLE2NotOfficeXmlFileException;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.ShapeTypes;
import org.apache.poi.util.Units;
import org.apache.poi.xssf.usermodel.XSSFAnchor;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFClientAnchor;
import org.apache.poi.xssf.usermodel.XSSFDrawing;
import org.apache.poi.xssf.usermodel.XSSFPicture;
import org.apache.poi.xssf.usermodel.XSSFShape;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFSimpleShape;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class ExcelLayoutParser {

    private static final long MAX_FILE_SIZE = 20L * 1024 * 1024;
    private static final int MAX_SHEETS = 20;
    private static final int MAX_ROWS_PER_SHEET = 5_000;
    private static final int MAX_COLUMNS_PER_SHEET = 300;
    private static final int MAX_CANDIDATES = 50_000;
    private static final double POINT_TO_PIXEL = 96d / 72d;

    public ParsedExcel parse(MultipartFile file) {
        validateFile(file);
        try (XSSFWorkbook workbook = new XSSFWorkbook(file.getInputStream())) {
            if (workbook.getNumberOfSheets() > MAX_SHEETS) {
                throw new BusinessException(StadiumErrorCode.EXCEL_LIMIT_EXCEEDED);
            }

            DataFormatter formatter = new DataFormatter(Locale.KOREAN);
            List<ExcelSheetResponse> sheets = new ArrayList<>();
            List<ExcelCandidateResponse> seats = new ArrayList<>();
            List<ExcelCandidateResponse> elements = new ArrayList<>();
            List<String> warnings = new ArrayList<>();

            for (int index = 0; index < workbook.getNumberOfSheets(); index++) {
                XSSFSheet sheet = workbook.getSheetAt(index);
                int rowCount = sheet.getPhysicalNumberOfRows();
                int columnCount = maxColumnCount(sheet);
                if (sheet.getLastRowNum() + 1 > MAX_ROWS_PER_SHEET || columnCount > MAX_COLUMNS_PER_SHEET) {
                    throw new BusinessException(StadiumErrorCode.EXCEL_LIMIT_EXCEEDED);
                }
                sheets.add(new ExcelSheetResponse(sheet.getSheetName(), rowCount, columnCount));
                readCells(sheet, index, formatter, seats, elements);
                readShapes(sheet, index, seats, elements, warnings);
                if (seats.size() + elements.size() > MAX_CANDIDATES) {
                    throw new BusinessException(StadiumErrorCode.EXCEL_LIMIT_EXCEEDED);
                }
            }

            if (seats.isEmpty()) {
                warnings.add("좌석 후보를 찾지 못했습니다. 셀 또는 Excel 도형에 좌석 정보가 있는지 확인해 주세요.");
            }
            return new ParsedExcel(sheets, seats, elements, warnings);
        } catch (BusinessException exception) {
            throw exception;
        } catch (EncryptedDocumentException | OLE2NotOfficeXmlFileException exception) {
            throw new BusinessException(StadiumErrorCode.ENCRYPTED_EXCEL);
        } catch (IOException | RuntimeException exception) {
            throw new BusinessException(StadiumErrorCode.INVALID_EXCEL);
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(StadiumErrorCode.INVALID_EXCEL);
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException(StadiumErrorCode.EXCEL_LIMIT_EXCEEDED);
        }
        String filename = file.getOriginalFilename();
        if (filename != null && filename.toLowerCase(Locale.ROOT).endsWith(".xlsm")) {
            throw new BusinessException(StadiumErrorCode.ENCRYPTED_EXCEL);
        }
        if (filename == null || !filename.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            throw new BusinessException(StadiumErrorCode.INVALID_EXCEL);
        }
    }

    private void readCells(XSSFSheet sheet, int sheetIndex, DataFormatter formatter,
                           List<ExcelCandidateResponse> seats,
                           List<ExcelCandidateResponse> elements) {
        for (Row row : sheet) {
            for (Cell cell : row) {
                String text = formatter.formatCellValue(cell).strip();
                XSSFCellStyle style = (XSSFCellStyle) cell.getCellStyle();
                // 좌석표는 값 없이 테두리·채우기만 적용한 셀을 좌석으로 쓰는 경우가 많다.
                // 기본 서식의 완전히 빈 셀만 제외하고, 명시적으로 서식이 있는 빈 셀은 검수 후보로 제공한다.
                if (text.isEmpty() && style.getIndex() == 0) continue;

                BigDecimal x = decimal(columnX(sheet, cell.getColumnIndex()));
                BigDecimal y = decimal(rowY(sheet, cell.getRowIndex()));
                BigDecimal width = decimal(sheet.getColumnWidthInPixels(cell.getColumnIndex()));
                BigDecimal height = decimal(row.getHeightInPoints() * POINT_TO_PIXEL);
                String fingerprint = "CELL:" + style.getIndex() + ":" + rounded(width) + "x" + rounded(height)
                        + ':' + cellVisualKind(style);
                ExcelCandidateResponse candidate = new ExcelCandidateResponse(
                        "s" + sheetIndex + "-cell-" + cell.getRowIndex() + "-" + cell.getColumnIndex(),
                        sheet.getSheetName(), "CELL", "CELL", text,
                        x, y, width, height, fingerprint);
                targetFor(text, elements, seats).add(candidate);
                ensureCandidateLimit(seats, elements);
            }
        }
    }

    private String cellVisualKind(XSSFCellStyle style) {
        boolean filled = style.getFillPattern() != FillPatternType.NO_FILL;
        boolean bordered = style.getBorderTop() != BorderStyle.NONE
                || style.getBorderRight() != BorderStyle.NONE
                || style.getBorderBottom() != BorderStyle.NONE
                || style.getBorderLeft() != BorderStyle.NONE;
        if (filled) return "FILL";
        if (bordered) return "BORDER";
        return "STYLE";
    }

    private void readShapes(XSSFSheet sheet, int sheetIndex,
                            List<ExcelCandidateResponse> seats,
                            List<ExcelCandidateResponse> elements,
                            List<String> warnings) {
        XSSFDrawing drawing = sheet.getDrawingPatriarch();
        if (drawing == null) return;

        int index = 0;
        for (XSSFShape shape : drawing.getShapes()) {
            XSSFAnchor anchor = shape.getAnchor();
            if (!(anchor instanceof XSSFClientAnchor clientAnchor)) continue;
            validateAnchor(clientAnchor);
            String shapeType = resolveShapeType(shape);
            String text = extractShapeText(shape);
            double startX = columnX(sheet, clientAnchor.getCol1()) + emuToPixel(clientAnchor.getDx1());
            double startY = rowY(sheet, clientAnchor.getRow1()) + emuToPixel(clientAnchor.getDy1());
            double endX = columnX(sheet, clientAnchor.getCol2()) + emuToPixel(clientAnchor.getDx2());
            double endY = rowY(sheet, clientAnchor.getRow2()) + emuToPixel(clientAnchor.getDy2());
            BigDecimal x = decimal(Math.min(startX, endX));
            BigDecimal y = decimal(Math.min(startY, endY));
            BigDecimal width = decimal(Math.max(1, Math.abs(endX - startX)));
            BigDecimal height = decimal(Math.max(1, Math.abs(endY - startY)));
            String fingerprint = shapeFingerprint(shape, shapeType, width, height);
            ExcelCandidateResponse candidate = new ExcelCandidateResponse(
                    "s" + sheetIndex + "-shape-" + index++, sheet.getSheetName(), "SHAPE", shapeType,
                    text, x, y, width, height, fingerprint);
            if (shape instanceof XSSFPicture) {
                warnings.add("시트 '" + sheet.getSheetName()
                        + "'의 이미지 내부 도형은 직접 분석하지 않습니다. 셀/도형 좌석표를 사용해 주세요.");
                continue;
            }
            targetFor(text, elements, seats).add(candidate);
            ensureCandidateLimit(seats, elements);
        }
    }

    private void ensureCandidateLimit(
            List<ExcelCandidateResponse> seats, List<ExcelCandidateResponse> elements) {
        if (seats.size() + elements.size() > MAX_CANDIDATES) {
            throw new BusinessException(StadiumErrorCode.EXCEL_LIMIT_EXCEEDED);
        }
    }

    private String extractShapeText(XSSFShape shape) {
        if (!(shape instanceof XSSFSimpleShape simpleShape)) return "";
        String text = simpleShape.getText();
        return text == null ? "" : text.strip();
    }

    private String resolveShapeType(XSSFShape shape) {
        if (shape instanceof XSSFPicture) return "PICTURE";
        if (!(shape instanceof XSSFSimpleShape simpleShape)) {
            return shape.getClass().getSimpleName().replace("XSSF", "").toUpperCase(Locale.ROOT);
        }

        return switch (simpleShape.getShapeType()) {
            case ShapeTypes.ELLIPSE -> "ELLIPSE";
            case ShapeTypes.RECT -> "RECTANGLE";
            case ShapeTypes.ROUND_RECT, ShapeTypes.ROUND_1_RECT,
                    ShapeTypes.ROUND_2_SAME_RECT, ShapeTypes.ROUND_2_DIAG_RECT -> "ROUNDED_RECTANGLE";
            case ShapeTypes.TRIANGLE -> "TRIANGLE";
            case ShapeTypes.RT_TRIANGLE -> "RIGHT_TRIANGLE";
            case ShapeTypes.DIAMOND -> "DIAMOND";
            case ShapeTypes.PENTAGON -> "PENTAGON";
            case ShapeTypes.HEXAGON -> "HEXAGON";
            case ShapeTypes.HEPTAGON -> "HEPTAGON";
            case ShapeTypes.OCTAGON -> "OCTAGON";
            case ShapeTypes.LINE, ShapeTypes.LINE_INV, ShapeTypes.STRAIGHT_CONNECTOR_1 -> "LINE";
            default -> "SHAPE_" + simpleShape.getShapeType();
        };
    }

    private String shapeFingerprint(XSSFShape shape, String shapeType,
                                    BigDecimal width, BigDecimal height) {
        String style = "";
        if (shape instanceof XSSFSimpleShape simpleShape) {
            var properties = simpleShape.getCTShape().getSpPr();
            String fill = properties.isSetSolidFill() ? properties.getSolidFill().xmlText() : "";
            String line = properties.isSetLn() ? properties.getLn().xmlText() : "";
            style = Integer.toUnsignedString((fill + '|' + line).hashCode(), 16);
        }
        return "SHAPE:" + shapeType + ':' + rounded(width) + 'x' + rounded(height) + ':' + style;
    }

    private void validateAnchor(XSSFClientAnchor anchor) {
        if (anchor.getRow1() < 0 || anchor.getRow2() < 0
                || anchor.getRow1() > MAX_ROWS_PER_SHEET || anchor.getRow2() > MAX_ROWS_PER_SHEET
                || anchor.getCol1() < 0 || anchor.getCol2() < 0
                || anchor.getCol1() > MAX_COLUMNS_PER_SHEET || anchor.getCol2() > MAX_COLUMNS_PER_SHEET) {
            throw new BusinessException(StadiumErrorCode.EXCEL_LIMIT_EXCEEDED);
        }
    }

    private double emuToPixel(int emu) {
        return (double) emu / Units.EMU_PER_PIXEL;
    }

    private List<ExcelCandidateResponse> targetFor(
            String text, List<ExcelCandidateResponse> elements, List<ExcelCandidateResponse> seats) {
        String upper = text.toUpperCase(Locale.ROOT);
        return upper.contains("STAGE") || upper.contains("무대") || upper.contains("기둥")
                || upper.contains("PILLAR") || upper.contains("출입구") || upper.contains("GATE")
                ? elements : seats;
    }

    private int maxColumnCount(XSSFSheet sheet) {
        int maximum = 0;
        for (Row row : sheet) maximum = Math.max(maximum, Math.max(0, row.getLastCellNum()));
        return maximum;
    }

    private double columnX(XSSFSheet sheet, int column) {
        double value = 0;
        for (int i = 0; i < column; i++) value += sheet.getColumnWidthInPixels(i);
        return value;
    }

    private double rowY(XSSFSheet sheet, int rowIndex) {
        double value = 0;
        for (int i = 0; i < rowIndex; i++) {
            Row row = sheet.getRow(i);
            value += (row == null ? sheet.getDefaultRowHeightInPoints() : row.getHeightInPoints()) * POINT_TO_PIXEL;
        }
        return value;
    }

    private BigDecimal decimal(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private long rounded(BigDecimal value) {
        return value.setScale(0, RoundingMode.HALF_UP).longValue();
    }

    public record ParsedExcel(
            List<ExcelSheetResponse> sheets,
            List<ExcelCandidateResponse> seatCandidates,
            List<ExcelCandidateResponse> elementCandidates,
            List<String> warnings
    ) {
    }
}
