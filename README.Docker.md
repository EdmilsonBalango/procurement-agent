### Building and running your application

When you're ready, start your application by running:
`docker compose up --build`.

Your application will be available at http://localhost:3000.

For the Karingani production DNS, use:

```bash
APP_ORIGIN=https://procurement.karingani.com
CORS_ORIGIN=https://procurement.karingani.com
SESSION_COOKIE_SECURE=true
```

If TLS is terminated by a reverse proxy, ensure it forwards `X-Forwarded-Proto=https`.

### Nginx vhost

An example Nginx site config for `procurement.karingani.com` is included at:

`deploy/nginx/procurement.karingani.com.conf`

It assumes:

- Nginx runs on the Docker host
- the app is published on `127.0.0.1:3000`
- TLS certificates are available under `/etc/letsencrypt/live/procurement.karingani.com/`

After copying the file into your Nginx sites directory, test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Deploying your application to the cloud

First, build your image, e.g.: `docker build -t myapp .`.
If your cloud uses a different CPU architecture than your development
machine (e.g., you are on a Mac M1 and your cloud provider is amd64),
you'll want to build the image for that platform, e.g.:
`docker build --platform=linux/amd64 -t myapp .`.

Then, push it to your registry, e.g. `docker push myregistry.com/myapp`.

Consult Docker's [getting started](https://docs.docker.com/go/get-started-sharing/)
docs for more detail on building and pushing.

### References
* [Docker's Node.js guide](https://docs.docker.com/language/nodejs/)
