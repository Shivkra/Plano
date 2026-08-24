#!/bin/bash
cd "/Users/siva/.gstack/projects/Claude/Planogram/server"
echo "Starting Warehouse Layout Planner..."
echo "Opening your browser in a couple seconds — leave this window open while you use the app."
echo ""
(sleep 2 && open "http://localhost:8934") &
node server.js
