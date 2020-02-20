const timeSplitRegex = /^(\d+)?(m|s|ms)?$/i

export const IsTime = (arg: string = '') => {
  return timeSplitRegex.test(arg)
}

export const TimeParser = (timeString: string = '') => {
  const match = timeSplitRegex.exec(timeString)

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
