package com.teacat.server.stadium.service;

import com.teacat.server.stadium.dto.response.ExcelCandidateResponse;
import org.apache.poi.ss.usermodel.ShapeTypes;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.util.Units;
import org.apache.poi.xssf.usermodel.XSSFClientAnchor;
import org.apache.poi.xssf.usermodel.XSSFDrawing;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFSimpleShape;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ExcelLayoutParserTests {

    private final ExcelLayoutParser parser = new ExcelLayoutParser();

    @Test
    void 값이_없어도_명시적_서식이_있는_셀은_좌석_후보로_인식한다() throws Exception {
        MockMultipartFile file;
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            XSSFSheet sheet = workbook.createSheet("좌석표");
            var style = workbook.createCellStyle();
            style.setFillForegroundColor(IndexedColors.LIGHT_BLUE.getIndex());
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            sheet.createRow(0).createCell(0).setCellStyle(style);
            workbook.write(output);
            file = new MockMultipartFile(
                    "file", "layout.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    output.toByteArray());
        }

        ExcelCandidateResponse candidate = parser.parse(file).seatCandidates().getFirst();

        assertThat(candidate.sourceType()).isEqualTo("CELL");
        assertThat(candidate.rawText()).isEmpty();
        assertThat(candidate.shapeType()).isEqualTo("CELL");
        assertThat(candidate.styleFingerprint()).endsWith(":FILL");
    }

    @Test
    void 엑셀의_원과_사각형을_서로_다른_좌석_도형으로_인식한다() throws Exception {
        MockMultipartFile file;
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            XSSFSheet sheet = workbook.createSheet("좌석표");
            XSSFDrawing drawing = sheet.createDrawingPatriarch();
            createShape(drawing, ShapeTypes.ELLIPSE, 0, 0, 1, 1);
            createShape(drawing, ShapeTypes.RECT, 1, 0, 2, 1);
            workbook.write(output);
            file = new MockMultipartFile(
                    "file", "layout.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    output.toByteArray());
        }

        ExcelLayoutParser.ParsedExcel result = parser.parse(file);
        List<ExcelCandidateResponse> candidates = result.seatCandidates();

        assertThat(candidates).extracting(ExcelCandidateResponse::shapeType)
                .containsExactly("ELLIPSE", "RECTANGLE");
        assertThat(candidates).extracting(ExcelCandidateResponse::styleFingerprint)
                .doesNotHaveDuplicates();
    }

    @Test
    void 도형의_셀_내부_오프셋을_좌표와_크기에_반영한다() throws Exception {
        MockMultipartFile file;
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            XSSFSheet sheet = workbook.createSheet("좌석표");
            XSSFDrawing drawing = sheet.createDrawingPatriarch();
            XSSFClientAnchor anchor = new XSSFClientAnchor(
                    Units.pixelToEMU(10), Units.pixelToEMU(5),
                    Units.pixelToEMU(30), Units.pixelToEMU(15),
                    0, 0, 1, 1);
            XSSFSimpleShape shape = drawing.createSimpleShape(anchor);
            shape.setShapeType(ShapeTypes.ELLIPSE);
            workbook.write(output);
            file = new MockMultipartFile(
                    "file", "layout.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    output.toByteArray());
        }

        ExcelCandidateResponse candidate = parser.parse(file).seatCandidates().getFirst();

        assertThat(candidate.x()).isEqualByComparingTo("10.00");
        assertThat(candidate.y()).isEqualByComparingTo("5.00");
        assertThat(candidate.width()).isGreaterThan(new BigDecimal("1.00"));
        assertThat(candidate.height()).isGreaterThan(new BigDecimal("1.00"));
    }

    @Test
    void 여러_시트를_층별_후보로_분리한다() throws Exception {
        MockMultipartFile file;
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var style = workbook.createCellStyle();
            style.setFillForegroundColor(IndexedColors.LIGHT_BLUE.getIndex());
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            workbook.createSheet("1F").createRow(0).createCell(0).setCellStyle(style);
            workbook.createSheet("2F").createRow(0).createCell(0).setCellStyle(style);
            workbook.write(output);
            file = new MockMultipartFile(
                    "file", "floors.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    output.toByteArray());
        }

        ExcelLayoutParser.ParsedExcel result = parser.parse(file);

        assertThat(result.sheets()).extracting(sheet -> sheet.name())
                .containsExactly("1F", "2F");
        assertThat(result.seatCandidates()).extracting(ExcelCandidateResponse::sheet)
                .containsExactly("1F", "2F");
        assertThat(result.seatCandidates()).extracting(ExcelCandidateResponse::candidateId)
                .doesNotHaveDuplicates();
    }

    private void createShape(
            XSSFDrawing drawing, int shapeType, int col1, int row1, int col2, int row2) {
        XSSFClientAnchor anchor = new XSSFClientAnchor(0, 0, 0, 0, col1, row1, col2, row2);
        XSSFSimpleShape shape = drawing.createSimpleShape(anchor);
        shape.setShapeType(shapeType);
        shape.setFillColor(220, 220, 220);
        shape.setLineStyleColor(40, 40, 40);
    }
}
