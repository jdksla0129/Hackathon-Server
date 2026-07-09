// OpenAPI 3.0 스펙 정의 (Swagger UI 문서용)
export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Hackathon API Server',
    version: '1.0.0',
    description:
      'Express + TypeScript + MySQL 기반 API 서버 문서입니다. Google OAuth 로그인, 번역, 행정 일정(스케줄) 관리 API를 제공합니다.'
  },
  servers: [{ url: '/', description: '현재 서버' }],
  tags: [
    { name: 'Health', description: '서버 상태 확인' },
    { name: 'Auth', description: 'Google OAuth 로그인 및 유저 프로필' },
    { name: 'Translation', description: '번역 API' },
    { name: 'Schedules', description: '행정 일정 관리 (JWT 인증 필수)' },
    { name: 'Countries', description: '이민 대상 국가 및 비자 유형 조회' },
    { name: 'Checklist', description: '이민 필수 서류 체크리스트 생성 및 조회' },
    { name: 'ProcessingTime', description: '실시간 서류 처리 기간 정보 조회' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: '로그인 API에서 발급받은 JWT를 입력하세요.'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          google_id: { type: 'string', example: '108888888888888888888' },
          email: { type: 'string', example: 'user@gmail.com' },
          name: { type: 'string', example: '홍길동' },
          picture: { type: 'string', example: 'https://lh3.googleusercontent.com/a/photo.jpg' },
          nationality: { type: 'string', nullable: true, example: 'KR' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      Schedule: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 10 },
          user_id: { type: 'integer', example: 1 },
          title: { type: 'string', example: '전입신고' },
          description: { type: 'string', example: '이사 후 14일 이내 전입신고 필수' },
          due_date: { type: 'string', format: 'date-time', example: '2026-07-23T00:00:00.000Z' },
          completed: { type: 'boolean', example: false },
          document_type: { type: 'string', nullable: true, example: 'moving' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: '에러 메시지' }
        }
      }
    },
    responses: {
      Unauthorized: {
        description: '인증 실패 (JWT 누락/만료)',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } }
        }
      },
      BadRequest: {
        description: '잘못된 요청',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: '헬스체크',
        responses: {
          200: {
            description: '서버 정상 동작',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/google': {
      post: {
        tags: ['Auth'],
        summary: 'Google OAuth 로그인 (앱용, idToken 방식)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['idToken'],
                properties: {
                  idToken: { type: 'string', description: 'Google OAuth id_token' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: '로그인 성공 (JWT 발급)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        token: { type: 'string' },
                        user: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/auth/google/login': {
      get: {
        tags: ['Auth'],
        summary: '웹 브라우저용 구글 동의 화면 리다이렉트',
        responses: {
          302: { description: '구글 동의 화면으로 리다이렉트' },
          500: { $ref: '#/components/responses/BadRequest' }
        }
      }
    },
    '/api/auth/google/callback': {
      get: {
        tags: ['Auth'],
        summary: '구글 로그인 콜백 처리',
        parameters: [
          { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'state', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: '로그인 성공 (JWT 발급)' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/auth/profile': {
      get: {
        tags: ['Auth'],
        summary: '내 프로필 조회',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: '프로필 조회 성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: { user: { $ref: '#/components/schemas/User' } }
                    }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/auth/nationality': {
      patch: {
        tags: ['Auth'],
        summary: '국적 선택 및 저장',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nationality'],
                properties: {
                  nationality: { type: 'string', example: 'KR' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: '국적 저장 성공' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/translation/translate': {
      post: {
        tags: ['Translation'],
        summary: '텍스트 번역 및 보정',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', example: '전입신고 안내문' },
                  targetLanguage: { type: 'string', example: 'en' },
                  sourceLanguage: { type: 'string', example: 'ko' },
                  format: { type: 'string', enum: ['md', 'txt'], example: 'txt' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: '번역 성공' },
          400: { $ref: '#/components/responses/BadRequest' }
        }
      }
    },
    '/api/schedules': {
      post: {
        tags: ['Schedules'],
        summary: '새 일정 등록',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'dueDate'],
                properties: {
                  title: { type: 'string', example: '전입신고' },
                  description: { type: 'string', example: '이사 후 14일 이내' },
                  dueDate: { type: 'string', format: 'date', example: '2026-07-23' },
                  documentType: { type: 'string', example: 'moving' },
                  completed: { type: 'boolean', example: false }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: '일정 생성 성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: { schedule: { $ref: '#/components/schemas/Schedule' } }
                    }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      },
      get: {
        tags: ['Schedules'],
        summary: '내 일정 전체 조회 (마감순 정렬)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: '일정 목록 조회 성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        schedules: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Schedule' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/schedules/auto-generate': {
      post: {
        tags: ['Schedules'],
        summary: '서류 기준일 기반 법적 마감 일정 일괄 자동 생성',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['documentType', 'baseDate'],
                properties: {
                  documentType: { type: 'string', example: 'moving' },
                  baseDate: { type: 'string', format: 'date', example: '2026-07-09' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: '일정 일괄 자동 생성 성공' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/schedules/{id}': {
      get: {
        tags: ['Schedules'],
        summary: '단일 일정 상세 조회',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: '일정 상세 조회 성공' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      },
      patch: {
        tags: ['Schedules'],
        summary: '일정 부분 수정 (완료 상태 변경 등)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  dueDate: { type: 'string', format: 'date' },
                  completed: { type: 'boolean' },
                  documentType: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: '일정 수정 성공' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      },
      delete: {
        tags: ['Schedules'],
        summary: '일정 삭제',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: '일정 삭제 성공' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/countries': {
      get: {
        tags: ['Countries'],
        summary: '지원 국가 목록 조회',
        description: '이민 서류 체크리스트 생성을 지원하는 국가 정보 목록을 반환합니다.',
        responses: {
          200: {
            description: '성공적으로 조회됨',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          code: { type: 'string', example: 'CA' },
                          name_ko: { type: 'string', example: '캐나다' },
                          name_en: { type: 'string', example: 'Canada' },
                          seeded: { type: 'boolean', example: true }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/countries/{code}/visa-types': {
      get: {
        tags: ['Countries'],
        summary: '특정 국가의 지원 비자 종류 목록 조회',
        description: '특정 국가에서 선택하여 진행할 수 있는 비자 종류 목록을 반환합니다. 시드 국가(US/CA/AU)는 시드 파일 정보를 활용하고 그 외 국가는 기본 4개 종류를 반환합니다.',
        parameters: [
          {
            name: 'code',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'ISO-2 국가 코드 (예: US, CA, AU)',
            example: 'CA'
          }
        ],
        responses: {
          200: {
            description: '성공적으로 조회됨',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    country: { type: 'string', example: 'CA' },
                    visaTypes: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          code: { type: 'string', example: 'skilled' },
                          name_ko: { type: 'string', example: '기술이민' },
                          name_en: { type: 'string', example: 'Skilled Migration' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' }
        }
      }
    },
    '/api/checklist': {
      post: {
        tags: ['Checklist'],
        summary: '이민 서류 체크리스트 생성 및 조회',
        description: '출발 국가, 대상 국가, 비자 유형 및 동반 가족 여부에 부합하는 준비 서류 리스트를 반환합니다. 로컬 시드가 있는 경우는 시드 데이터를 가공하여, 없는 경우는 실시간 Gemini 2.5-flash API 2단계 호출을 사용하여 생성 및 캐싱(24시간) 처리합니다.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['from', 'to', 'visaType'],
                properties: {
                  from: { type: 'string', example: 'KR', description: '출발 국가 코드 (ISO-2)' },
                  to: { type: 'string', example: 'CA', description: '목적지 국가 코드 (ISO-2)' },
                  visaType: { type: 'string', example: 'skilled', description: '비자 유형 (skilled, family)' },
                  family: { type: 'boolean', example: true, description: '배우자 등 동반 가족 여부' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: '체크리스트 생성 또는 캐시 반환 성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        from: { type: 'string', example: 'KR' },
                        to: { type: 'string', example: 'CA' },
                        visaType: { type: 'string', example: 'skilled' },
                        source: { type: 'string', example: 'seed', description: '데이터 획득 소스 (seed, gemini)' },
                        generatedAt: { type: 'string', format: 'date-time' },
                        documents: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name_ko: { type: 'string', example: '여권 (6개월 이상 유효)' },
                              name_en: { type: 'string', example: 'Passport (valid for at least 6 months)' },
                              issuer_ko: { type: 'string', example: '외교부' },
                              apostille_required: { type: 'boolean', example: false },
                              translation_required: { type: 'boolean', example: false },
                              validity_months: { type: 'integer', example: 6 },
                              required_for: { type: 'string', example: 'all' },
                              official_link: { type: 'string', example: 'https://www.passport.go.kr' },
                              notes: { type: 'string', example: '만료일이 최소 6개월 이상 남아있어야 합니다.' }
                            }
                          }
                        },
                        sources: {
                          type: 'array',
                          items: { type: 'string', example: 'https://www.canada.ca' }
                        },
                        disclaimer: { type: 'string', example: '본 정보는 참고용이며, 최신 요건은 반드시 공식 기관에서 확인하세요.' }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          502: { description: 'AI 응답 데이터 구조화 실패' },
          503: { description: 'API 속도 제한 초과' }
        }
      }
    },
    '/api/processing-time': {
      get: {
        tags: ['ProcessingTime'],
        summary: '캐나다 이민부(IRCC) 주요 프로그램별 실시간 처리 기간 조회',
        description: '캐나다 공식 JSON API 데이터를 기반으로 한국인 지원자를 위한 대표 이민/비자 프로그램들의 실시간 처리 기간 목록을 가공하여 제공합니다. (현재 캐나다 CA만 가능)',
        parameters: [
          {
            name: 'country',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            example: 'CA',
            description: '대상 국가 코드 (CA만 지원)'
          }
        ],
        responses: {
          200: {
            description: '성공적으로 처리 기간 목록을 조회함',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    country: { type: 'string', example: 'CA' },
                    countryName: { type: 'string', example: 'Canada' },
                    generatedAt: { type: 'string', format: 'date-time' },
                    source: { type: 'string', example: 'IRCC Live JSON API' },
                    programs: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          program_id: { type: 'string', example: 'study_permit' },
                          name_ko: { type: 'string', example: '학생 비자 (Study Permit)' },
                          name_en: { type: 'string', example: 'Study Permit (Outside Canada)' },
                          processing_time: { type: 'string', example: '7 weeks' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          501: { description: '미지원 국가 요청' }
        }
      }
    }
  }
};
