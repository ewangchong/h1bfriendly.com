#!/bin/bash
# run_production_etl.sh - Server-side helper to run the ETL Pipeline

export DATA_DIR="/home/ec2-user/h1b-data"
export DONE_DIR="$DATA_DIR/done"
export DATABASE_URL="postgresql://h1b:generated_random_pass_123@localhost:5432/h1bfriend"

cd /home/ec2-user/h1bfriend/apps/etl || exit
source venv/bin/activate

mkdir -p "$DONE_DIR"

echo "=========================================================="
echo "    Starting Python ETL Pipeline (Host Instance)"
echo "    Target Database: $DATABASE_URL"
echo "=========================================================="

echo "▶ Step 1: Prepare (Drop lca_raw indexes)"
python3 main.py --prepare

echo ""
echo "▶ Step 2: Loop parsing pending Excel files"
for file in $(ls -1 "$DATA_DIR"/*.xlsx 2>/dev/null | sort); do
    filename=$(basename "$file")
    
    if [[ "$filename" =~ (20[0-9]{2}) ]]; then
        year="${BASH_REMATCH[1]}"
        echo "----------------------------------------------------------"
        echo "Loading: $filename (Year: $year)"
        echo "----------------------------------------------------------"
        
        python3 main.py --file "$file" --year "$year" --skip-indexes --skip-caches
        
        if [ $? -eq 0 ]; then
            echo "✅ Success! $filename moved to done/ directory"
            mv "$file" "$DONE_DIR/"
        else
            echo "❌ Failed to load $filename! Fixing the data and re-running will resume the load."
            exit 1
        fi
    fi
done

echo ""
echo "=========================================================="
echo "All pending data files processed!"
echo "▶ Step 3: Finalize (Rebuild indexes & regenerate view caches)"
echo "=========================================================="
python3 main.py --finalize

echo "🎉 ETL Pipeline execution completed successfully!"
