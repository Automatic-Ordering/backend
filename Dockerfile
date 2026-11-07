# Node.js LTS 이미지
FROM node:22-alpine

# 작업 디렉터리
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --omit=dev

# 소스 코드 복사
COPY src ./src

# 포트 설정
EXPOSE 3000

# 서버 실행
CMD ["npm", "start"]