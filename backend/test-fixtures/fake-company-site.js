const http = require("http");

const pages = {
  "/": `<html><head><title>Acme Corp</title></head><body>
    <nav>
      <a href="/about">About</a>
      <a href="/life-at-acme">Life at Acme</a>
      <a href="/blog">Blog</a>
      <a href="/contact">Contact</a>
    </nav>
    <h1>Acme Corp</h1>
    <p>Acme builds developer tools that help teams ship faster. Founded in 2018, we're a remote-first company of 80 people.</p>
  </body></html>`,

  "/about": `<html><body>
    <h1>About Acme</h1>
    <p>We make infrastructure tooling for backend teams. Our platform handles millions of requests per day for customers across fintech and healthcare.</p>
  </body></html>`,

  // Deliberately NOT at /careers or /jobs, proves the crawler can't
  // hardcode a path list, same problem the brief describes for GitLab/PostHog.
  "/life-at-acme": `<html><body>
    <h1>Life at Acme</h1>
    <p>We're hiring across engineering. Our interview process for engineering roles is: a 30-minute recruiter screen, a take-home exercise (usually 2-3 hours), then a final round with two 45-minute technical interviews and one system design discussion. We value clear communication and give candidates feedback within 3 business days.</p>
    <a href="/open-roles">See open roles</a>
  </body></html>`,

  "/open-roles": `<html><body>
    <h1>Open Roles</h1>
    <p>Senior Backend Engineer, Frontend Engineer, DevOps Engineer</p>
  </body></html>`,

  "/blog": `<html><body>
    <h1>Engineering Blog</h1>
    <p>Read about our engineering culture and recent technical posts.</p>
  </body></html>`,

  "/contact": `<html><body><h1>Contact Us</h1><p>Email hello@acme.example</p></body></html>`,

  "/robots.txt": `User-agent: *
Disallow: /contact
Allow: /
`,
};

function startFixtureServer(port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const path = req.url.split("?")[0];
      const body = pages[path];
      if (body) {
        res.writeHead(200, {
          "Content-Type": path.endsWith(".txt") ? "text/plain" : "text/html",
        });
        res.end(body);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
      }
    });
    server.listen(port, () => resolve(server));
  });
}

module.exports = { startFixtureServer };

// Also runnable standalone: node test-fixtures/fake-company-site.js
if (require.main === module) {
  const port = process.env.FIXTURE_PORT || 8099;
  startFixtureServer(port).then(() => {
    console.log(`Fake company site running at http://localhost:${port}/`);
  });
}
