# 03. DB Design

## 기본 원칙

내부 데이터 구조는 이벤트 기반으로 설계한다.

사용자 화면에서는 타임라인과 날짜별 기록 형태로 보여준다.

## 주요 엔터티

### User

- id
- socialProvider
- socialProviderUserId
- createdAt
- updatedAt

### Pet

- id
- userId
- name
- species
- birthDate
- isEstimatedBirthDate
- gender
- photoUrl
- breed
- currentWeight
- neutered
- createdAt
- updatedAt

### HealthRecord

공통 기록 엔터티로 사용하거나 유형별 상세 테이블과 연결한다.

- id
- petId
- recordType
- recordDate
- memo
- createdAt
- updatedAt

recordType 예시

- meal
- stool
- urine
- vomit
- walk
- condition
- weight
- healthPhoto
- medicalRecord
- note

recordType = note는 홈 → 더보기 → 메모(오늘의 메모)에 대응한다.

날짜당 하나만 존재하는 자유 텍스트이며, memo 필드에 본문을 저장한다.

다른 recordType의 memo 필드(배변, 컨디션 등에 딸린 메모)와는 별개의 데이터로 취급한다. 전체 기록보기의 "메모" 탭은 recordType = note인 레코드만 조회한다.

### RecordPhoto

- id
- recordId
- category
- imageUrl
- thumbnailUrl
- sortOrder
- createdAt

### Schedule

미래에 해야 할 건강관리 일정을 저장한다.

- id
- petId
- scheduleType
- customTypeName
- scheduledDate
- status
- hospitalName
- productName
- memo
- repeatIntervalType
- repeatIntervalValue
- notificationSetting
- linkedRecordId
- createdAt
- updatedAt

scheduleType

- vaccination
- heartworm
- deworming
- healthCheck
- hospitalVisit
- custom

scheduleType = custom일 때 customTypeName에 사용자가 직접 입력한 일정 이름을 저장한다. 그 외 타입은 customTypeName을 사용하지 않는다 (null).

status

- planned
- completed
- cancelled
- missed

### MedicalRecord

실제로 완료한 건강관리 또는 병원 방문 기록이다.

- id
- petId
- scheduleId
- medicalType
- executedDate
- hospitalName
- productName
- memo
- createdAt
- updatedAt

## 일정과 기록의 관계

Schedule과 Record는 분리한다.

일정 완료 시

1. 실제 완료 기록 생성
2. 일정 상태를 완료로 변경
3. scheduleId로 연결
4. 반복 주기가 있다면 다음 일정 생성

사용자가 기록을 먼저 생성한 경우

- 다음 일정 등록 여부를 안내한다.
- 사용자가 동의하면 Schedule을 생성한다.

## 사진 제한

- 기록당 최대 5장
- 업로드 순서 저장
- 압축 이미지 저장
- 향후 AI 분석 결과와 연결할 수 있는 구조 고려
