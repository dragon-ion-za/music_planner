import { app } from './app';

const required = ['AUTH0_DOMAIN', 'AUTH0_AUDIENCE'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
