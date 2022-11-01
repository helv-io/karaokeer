interface String {
  safeName(): string
}

String.prototype.safeName = function () {
  let ret = this.toString()
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

  invalidChars.forEach((_c, i) => {
    ret = ret.replaceAll(invalidChars[i], validChars[i])
  })
  return ret
}
