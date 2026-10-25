/** Помилка з HTTP-статусом. Її перехоплює errorHandler і повертає клієнту. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
