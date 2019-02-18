export class NotImplementedError extends Error {
  constructor(message) {
    super(message);

    this.message = message;
    this.name = 'NotImplementedError';
  }
}

export class HttpError extends Error {
  constructor(data, status) {
    console.log(status, 'data', data);
    super(data);
    // for (let message of data) {}
    const message = data.errors[0] || data;
    console.log(status, 'message', message);
    this.message = `${message.title}: ${message.detail}`;
    this.status = status;
    // this.body = body;
    this.name = 'HttpError';
  }
}
