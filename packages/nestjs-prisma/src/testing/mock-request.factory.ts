export function createMockRequest(overrides: Record<string, any> = {}) {
  return {
    user: { id: 'user-1', sub: 'user-1', email: 'test@example.com', roles: [] },
    headers: { 'user-agent': 'jest-test', 'x-forwarded-for': '127.0.0.1' },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    method: 'GET',
    url: '/test',
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

export function createMockResponse() {
  const res: any = {
    statusCode: 200,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
  };
  return res;
}

export function createMockExecutionContext(request?: any, handler?: any) {
  const req = request ?? createMockRequest();
  const res = createMockResponse();
  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(req),
      getResponse: jest.fn().mockReturnValue(res),
    }),
    getHandler: jest.fn().mockReturnValue(handler ?? (() => {})),
    getClass: jest.fn().mockReturnValue(class TestController {}),
    getArgs: jest.fn().mockReturnValue([req, res]),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn().mockReturnValue('http'),
  };
}
