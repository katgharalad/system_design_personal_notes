Container starter exercise

1. Download server.mjs and Dockerfile into one directory.
2. Run: docker build -t lab-api:local .
3. Run: docker run --rm -p 3000:3000 lab-api:local
4. Open http://127.0.0.1:3000/health in a browser.
5. Stop with Ctrl+C. Explain what state disappears with the container.

This exercise runs locally. It does not create AWS resources.
