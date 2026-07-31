# 04. API Specification Draft

이 문서는 실제 기술 스택 확정 전의 초안이다.

## 인증

### POST /auth/social

소셜 로그인 처리

지원 provider

- kakao
- apple
- google

## 반려동물

### GET /pets

사용자의 반려동물 목록 조회

### POST /pets

반려동물 등록

### GET /pets/:petId

반려동물 상세 조회

### PATCH /pets/:petId

반려동물 정보 수정

### DELETE /pets/:petId

반려동물 삭제

## 기록

### GET /pets/:petId/records

기간별 기록 조회

주요 query

- from
- to
- type

### POST /pets/:petId/records

일상 기록 생성

### PATCH /records/:recordId

기록 수정

### DELETE /records/:recordId

기록 삭제

### POST /records/:recordId/photos

사진 업로드

## 캘린더

### GET /pets/:petId/calendar

월별 기록 유무와 일정 상태 조회

## 통계

### GET /pets/:petId/statistics

query

- period: 7d, 30d, 3m, 1y

응답 범위

- 기록한 날짜 수
- 배변 상태와 횟수
- 소변 횟수
- 산책 횟수와 총시간
- 컨디션 분포

### GET /pets/:petId/weight-statistics

query

- period: 1m, 3m, 6m, 1y, all

## 일정

### GET /pets/:petId/schedules

### POST /pets/:petId/schedules

### PATCH /schedules/:scheduleId

### POST /schedules/:scheduleId/complete

완료 처리 시 실제 기록을 생성하고 다음 일정을 생성할 수 있다.

### POST /medical-records/:recordId/create-next-schedule

기록을 먼저 만든 뒤 다음 일정 생성
