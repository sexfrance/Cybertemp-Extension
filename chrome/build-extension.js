
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outDir = path.join(__dirname, 'out');
const nextDir = path.join(outDir, '_next');
const newNextDir = path.join(outDir, 'next');

console.log('Building Next.js project...');
try {
    execSync('next build', { stdio: 'inherit' });
} catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
}

if (fs.existsSync(nextDir)) {
    console.log('Renaming _next to next...');
    fs.renameSync(nextDir, newNextDir);

    // Also handle _not-found.html if it exists
    const notFoundFile = path.join(outDir, '_not-found.html');
    const newNotFoundFile = path.join(outDir, '404.html');
    if (fs.existsSync(notFoundFile)) {
        console.log('Renaming _not-found.html to 404.html...');
        fs.renameSync(notFoundFile, newNotFoundFile);
    }

    // Handle _not-found directory
    const notFoundDir = path.join(outDir, '_not-found');
    const newNotFoundDir = path.join(outDir, 'not-found');
    if (fs.existsSync(notFoundDir)) {
        console.log('Renaming _not-found directory to not-found...');
        fs.renameSync(notFoundDir, newNotFoundDir);
    }

    // Clean up any other files starting with _ or __
    const allFiles = fs.readdirSync(outDir);
    allFiles.forEach(file => {
        if (file.startsWith('_') || file.startsWith('__')) {
            console.log(`Removing restricted metadata file: ${file}`);
            fs.rmSync(path.join(outDir, file), { recursive: true, force: true });
        }
    });

    console.log('Updating references in files...');
    const replaceInFile = (filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        const newContent = content.replace(/\/_next\//g, '/next/');
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent);
        }
    };

    const processDirectory = (dir) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                processDirectory(filePath);
            } else if (file.endsWith('.html')) {
                // Special handling for HTML to extract inline scripts
                let content = fs.readFileSync(filePath, 'utf8');

                // Replace _next paths first
                content = content.replace(/\/_next\//g, '/next/');

                // Extract inline scripts
                let scriptCount = 0;
                // Match <script> tags that do NOT have a 'src' attribute
                // We also want to ignore type="application/json" or type="application/ld+json" as those are data, not code, and usually allowed (or not script-src restricted)
                // Actually, to be safe for strict CSP, we might want to verify. But usually data blocks are fine.
                // The main culprits are inline JS chunks.

                content = content.replace(/<script((?![^>]*\bsrc=)[^>]*)>([\s\S]*?)<\/script>/gi, (match, attributes, scriptContent) => {
                    // If it's a JSON script (Next.js data), we usually SHOULD leave it alone as it's not executable.
                    // But Chrome might still complain if it's strict? No, script-src applies to executable scripts.
                    // Let's check if it has type="application/json".
                    if (attributes.includes('type="application/json"') || attributes.includes("type='application/json'")) {
                        return match; // valid, don't extract
                    }

                    scriptCount++;
                    const scriptName = `inline-${path.basename(file, '.html')}-${scriptCount}.js`;
                    const scriptPath = path.join(path.dirname(filePath), scriptName);

                    console.log(`Extracting inline script to ${scriptName}...`);
                    // Verify scriptContent isn't empty
                    if (!scriptContent.trim()) return match;

                    fs.writeFileSync(scriptPath, scriptContent);

                    // Maintain other attributes (like id) if possible, but simpler to just replace with src
                    // If the original had 'id', we might need it? 
                    // Next.js hydration scripts usually don't have IDs unless it's the JSON one.
                    // Webpack bootstrap might.
                    // Let's keep the attributes but add src.

                    return `<script src="./${scriptName}"${attributes}></script>`;
                });

                fs.writeFileSync(filePath, content);
            } else if (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.json')) {
                replaceInFile(filePath);
            }
        });
    };

    processDirectory(outDir);
    console.log('Extension build fixed successfully!');
} else {
    console.warn('_next directory not found. Build might have failed or verify output structure.');
}
