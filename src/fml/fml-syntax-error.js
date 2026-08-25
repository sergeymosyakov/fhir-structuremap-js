// A lex/parse error with source position, for actionable messages against real FML text.
export class FMLSyntaxError extends Error {
  constructor(message, line, col) {
    super(`${message} (line ${line}, col ${col})`);
    this.name = 'FMLSyntaxError';
    this.line = line;
    this.col = col;
  }
}
