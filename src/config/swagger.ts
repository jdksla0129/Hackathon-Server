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
    { name: 'Schedules', description: '행정 일정 관리 (JWT 인증 필수)' }
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
          200: {
            description: '번역 및 행동 지침 추출 성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: '구글 렌즈 일반 텍스트 번역 및 오타 보정이 성공적으로 완료되었습니다.' },
                    data: {
                      type: 'object',
                      properties: {
                        originalText: { type: 'string', example: '전입신고 안내문' },
                        correctedText: { type: 'string', example: '전입신고 안내문' },
                        translatedText: { type: 'string', example: 'Notice of Moving-in Report' },
                        explanation: { type: 'string', example: '오탈자를 보정하고 자연스럽게 번역했습니다.' },
                        documentType: { type: 'string', example: '출입국 및 외국인 등록 안내문' },
                        summary: { type: 'string', example: '대한민국 내 주소지가 변경되었을 때 신고해야 하는 의무를 설명하는 문서입니다.' },
                        actionItems: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              action: { type: 'string', example: '신규 이사 후 15일 이내에 체류지 변경 신고를 진행하십시오.' },
                              deadline: { type: 'string', nullable: true, example: '이사 완료 후 15일 이내' },
                              priority: { type: 'string', enum: ['high', 'medium', 'low'], example: 'high' },
                              details: { type: 'string', example: '관할 주민센터 또는 하이코리아 웹사이트에서 신고하십시오.' }
                            }
                          }
                        },
                        warnings: {
                          type: 'array',
                          items: { type: 'string' },
                          example: ['체류지 변경 신고 기한(15일)을 넘길 경우 최대 100만 원 이하의 과태료가 부과됩니다.']
                        },
                        fileName: { type: 'string', example: 'translation_1719918239_abc123.md' },
                        downloadUrl: { type: 'string', example: 'http://localhost:3000/downloads/translation_1719918239_abc123.md' }
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
    }
  }
};
