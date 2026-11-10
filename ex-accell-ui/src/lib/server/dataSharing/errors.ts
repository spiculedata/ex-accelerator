// A failure the caller caused and may read about (a 4xx). Anything else is answered generically and logged in full.

export class DataSharingError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'DataSharingError';
  }
}

export const badRequest = (message: string) => new DataSharingError(400, message);
export const notFound = (message: string) => new DataSharingError(404, message);
export const forbidden = (message: string) => new DataSharingError(403, message);
export const conflict = (message: string) => new DataSharingError(409, message);
export const unprocessable = (message: string) => new DataSharingError(422, message);
