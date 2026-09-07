pipeline {
    agent any
    stages {
        stage('Check') {
            steps {
                sh 'echo "연결 성공"'
                sh 'ls -al'
            }
        }
    }
    post {
        success { script { notifyMM('#41BE89', '✅ 배포 성공') } }
        failure { script { notifyMM('#D24B4E', '❌ 배포 실패') } }
    }
}

def notifyMM(String color, String title) {
    withCredentials([string(credentialsId: 'mm-webhook', variable: 'HOOK')]) {
        def payload = """{"attachments":[{"color":"${color}","title":"${title}","text":"**${env.JOB_NAME}** #${env.BUILD_NUMBER}\\n[빌드 로그 보기](${env.BUILD_URL}console)"}]}"""
        sh """curl -s -X POST -H 'Content-Type: application/json' -d '${payload}' "\$HOOK" """
    }
}