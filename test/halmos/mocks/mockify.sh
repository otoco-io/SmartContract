#!/bin/bash

echo "Enter the file name: "
read fileName

searchPath="contracts/"
foundFile=$(find $searchPath -name ${fileName}.sol | head -n 1)

if [ -z "$foundFile" ]; then
    echo "File '$fileName' not found in '$searchPath'"
    exit 1
fi

outputPath="test/halmos/mocks/"
newFileName="${outputPath}${fileName}Mock.sol"
cp "${foundFile}" "${newFileName}"

# Replace the words "private" with "internal".
sed -i 's/\bprivate\b/internal/g' "${newFileName}"

# Replace the words "external" with "public".
sed -i 's/\bexternal\b/public/g' "${newFileName}"

# Fix the receive() function in case of its existance.
if grep -q "receive()" "${newFileName}"; then
    sed -i '/receive()/ s/\bpublic\b/external/g' "${newFileName}"
fi

# Add "Mock" to contract name.
sed -i "s/\(contract\s\+\)\(\S\+\)/\1\2Mock/" "${newFileName}"

echo "File '${foundFile}' has been copied to '${newFileName}' and modified."
