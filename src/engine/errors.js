export class EngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EngineError';
  }
}
