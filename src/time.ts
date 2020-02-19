export const TimeParser = (timeString: string = '') => {
  const match = /^(-?(?:\d+)?\.?\d+)(m|s|ms)?$/i.exec(timeString)

  if (match && match.length >= 3) {
    const numericSegment = parseFloat(match[1])

    switch ((match[2] || 'ms').toLowerCase()) {
      case 'm':
        return numericSegment * 60000
      case 's':
        return numericSegment * 1000
      case 'ms':
        return numericSegment
    }
  }

  return null
}

export const TimeSearcher = (modifiers: object) => {
  for (let key in modifiers) {
    let parsedTime = TimeParser(key)

    if (parsedTime !== null) {
      return parsedTime
    }
  }

  return null
}
