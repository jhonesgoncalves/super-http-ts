import express, { Request, Response } from 'express';
import { HttpClientFactory } from './../src';

// Cria uma instância do express
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de exemplo
app.get('/', (req: Request, res: Response) => {
  const httpClient = HttpClientFactory.create('https://viacep.com.br/ws');
  httpClient
    .circuitBreak({ failureThreshold: 3, successThreshold: 2, timeoutMs: 6000 })
    .retry(3, 1000)
    .request({
      url: '/01001000',
      method: 'get',
    })
    .then((response) => res.send(response.data))
    .catch((error) => {
      console.log(error);
      res.send(error);
    });
});

app.get('/instance', (req: Request, res: Response) => {
  const httpClient = HttpClientFactory.create('http://httpstat.us/503');
  httpClient
    .retry(3, 1000)
    .circuitBreak({ failureThreshold: 3, successThreshold: 2, timeoutMs: 6000 })
    .request({
      url: '/dsfdsf',
      method: 'get',
    })
    .then((response) => res.send(response.data))
    .catch((error) => {
      console.log(error);
      res.send(error);
    });
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
