function findLargestNumber(text) {
    // Extract numbers from the text using regular expression

    if (!text) {
        return ''
    }

    const numbers = text.match(/\d+/g);

    // Convert the extracted numbers to integers and find the maximum
    const largestNumber = Math.max(...numbers.map(Number));

    return largestNumber;
}


console.log(findLargestNumber(''));