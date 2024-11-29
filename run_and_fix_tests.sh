#!/bin/bash

# Set path to Cursor executable
CURSOR="/Applications/Cursor.app/Contents/MacOS/Cursor"

# Check if Cursor exists
if [ ! -f "$CURSOR" ]; then
    echo "Error: Cursor not found at $CURSOR"
    echo "Please make sure Cursor is installed in the Applications folder"
    exit 1
fi

iteration=1

while true; do
    # Step 1: Run cucumber tests and capture output
    echo "----------------------------------------"
    echo "Iteration $iteration: Running tests..."
    npx cucumber-js --profile mathInvaders --fail-fast > test_output.txt 2>&1
    TEST_EXIT_CODE=$?

    # Parse test results
    total=$(grep -c "Scenario:" test_output.txt)
    passed=$(grep -c "✓" test_output.txt)
    failed=$((total - passed))
    
    echo "Test Results:"
    echo "  Total: $total"
    echo "  Passed: $passed"
    echo "  Failed: $failed"

    # Step 2: If tests pass, we're done
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        echo "All tests passed!"
        exit 0
    fi

    # Step 3: If tests failed, use Cursor Composer
    echo "Getting fixes from Composer..."
    TEST_OUTPUT=$(cat test_output.txt)
    
    # Use Cursor's CLI to get fixes
    "$CURSOR" --chat "please fix" < test_output.txt > fixes.txt
    
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
                if [[ $code_line == "\`\`\`" ]]; then
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
    iteration=$((iteration + 1))
done 