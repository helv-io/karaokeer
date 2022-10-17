interface String {
  safeName(): string
}

String.prototype.safeName = function () {
  let ret = this.toString()
  invalidChars.forEach((_c, i) => {
    ret = ret.replace(invalidChars[i], validChars[i])
  })
  return ret
}

const invalidChars = [
  '@',
  '$',
  '%',
  '&',
  '\\',
  '/',
  ':',
  '*',
  '?',
  '”',
  '‘',
  '<',
  '>',
  '|',
  '~',
  '`',
  '#',
  '^',
  '+',
  '=',
  '{',
  '}',
  '[',
  ']',
  ';',
  '!',
  '’'
]
const validChars = [
  ' at ',
  'S',
  'pc',
  ' and ',
  '_',
  '_',
  '-',
  '_',
  '_',
  '',
  ' ',
  '(',
  ')',
  '-',
  '-',
  '',
  '_',
  '-',
  '-',
  '-',
  '(',
  ')',
  '(',
  ')',
  '-',
  '_',
  ''
]
