#!/bin/bash

# Check if ANTHROPIC_API_KEY is set
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY environment variable is not set"
    exit 1
fi

while true; do
    # Step 1: Run cucumber tests and capture output
    echo "Running tests..."
    npx cucumber-js --profile mathInvaders > test_output.txt 2>&1
    TEST_EXIT_CODE=$?

    # Step 2: If tests pass, we're done
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        echo "All tests passed!"
        exit 0
    fi

    # Step 3: If tests failed, get and apply fixes from Claude
    echo "Tests failed. Getting fixes from Claude..."
    TEST_OUTPUT=$(cat test_output.txt)
    
    # Make API call to Claude
    curl https://api.anthropic.com/v1/messages \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -H "content-type: application/json" \
        -d "{
            \"model\": \"claude-3-sonnet-20240229\",
            \"max_tokens\": 4096,
            \"messages\": [{
                \"role\": \"user\",
                \"content\": \"Here is the output from my failed cucumber tests. Please fix the issues:\\n\\n${TEST_OUTPUT}\"
            }]
        }" > response.json
    
    # Extract and apply fixes
    jq -r '.content[0].text' response.json > fixes.txt
    
    # Process and apply fixes
    while IFS= read -r line; do
        if [[ $line =~ ^"\`\`\`"([^:]+):(.+) ]]; then
            # Extract language and filepath
            LANG="${BASH_REMATCH[1]}"
            FILE="${BASH_REMATCH[2]}"
            
            # Create temp file for the code block content
            TEMP_FILE=$(mktemp)
            
            # Read until closing code block
            while IFS= read -r code_line; do
                if [[ $code_line == ""\`\`\`" ]]; then
                    break
                fi
                echo "$code_line" >> "$TEMP_FILE"
            done
            
            # Apply the changes
            mv "$TEMP_FILE" "$FILE"
            echo "Applied changes to $FILE"
        fi
    done < fixes.txt

    echo "Fixes applied. Starting next iteration..."
    echo "----------------------------------------"
done 