# 데이터 모델

## ERD 개요

```
User ──── TeamMember ──── Team
                           │
                        Project
                         ┌─┴────────────────┐
                      TestCase           Comment
                  (상태 추적 단위)    (selector, boundingRect)
                                       testCaseId? (optional)
```

---

## 테이블 정의

### User
| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| email | String | 이메일 (unique) |
| name | String | 이름 |
| password | String | 해시된 비밀번호 |
| createdAt | DateTime | 생성일 |

### Team
| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| name | String | 팀 이름 |
| createdAt | DateTime | 생성일 |

### TeamMember
| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| teamId | String | FK → Team |
| userId | String | FK → User |
| createdAt | DateTime | 가입일 |

### TeamInvitation
| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| teamId | String | FK → Team |
| email | String | 초대받은 이메일 |
| token | String | 초대 토큰 (unique) |
| status | Enum | PENDING / ACCEPTED / EXPIRED |
| createdAt | DateTime | 생성일 |

### Project
| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| teamId | String | FK → Team |
| name | String | 프로젝트 이름 |
| url | String | QA 대상 URL |
| imageUrl | String? | 대표 이미지 경로 (썸네일) |
| createdAt | DateTime | 생성일 |

### TestCase
| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| projectId | String | FK → Project |
| createdById | String | FK → User |
| title | String | 테스트 케이스 제목 |
| description | String? | 설명 |
| status | Enum | IN_PROGRESS / DONE / FAILED |
| createdAt | DateTime | 생성일 |

### Comment
| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| projectId | String | FK → Project |
| testCaseId | String? | FK → TestCase (optional) |
| createdById | String? | FK → User (webhook 생성 시 null 가능) |
| assigneeId | String? | FK → User (담당 개발자) |
| content | String | 댓글 내용 |
| status | Enum | IN_PROGRESS / DONE / FAILED |
| selector | String | DOM 선택자 (e.g. `#login-btn`) |
| boundingRect | Json | 요소 위치 `{ x, y, width, height }` |
| tagName | String | 요소 태그명 |
| textContent | String? | 요소 텍스트 |
| pageUrl | String? | 댓글이 달린 페이지 URL |
| createdAt | DateTime | 생성일 |

### McpApiKey
| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| teamId | String | FK → Team |
| createdById | String | FK → User |
| key | String | API 키 (unique) |
| createdAt | DateTime | 생성일 |
