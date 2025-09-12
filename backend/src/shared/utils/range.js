const range = (count, increment = 1, start = 0) => [...Array(count).keys()].map(n => n * increment + start)

export default range
