export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly params: Record<string, string | number> | undefined = undefined,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
