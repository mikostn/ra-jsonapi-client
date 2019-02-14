export class NotImplementedError extends Error {
  constructor(message) {
    super(message);

    this.message = message;
    this.name = 'NotImplementedError';
  }
}

export class HttpError extends Error {
  constructor(message, status, body = null) {
    console.log(status, 'message', message);
    super(message);

    console.log(status, 'message', message);

    this.message = message.msg || JSON.stringify(message);
    this.status = status;
    this.body = body;
    this.name = 'HttpError';
  }
}
