import Fastify from 'fastify'

const fastify = Fastify({ logger: true })

fastify.get('/ping', async (request, reply) => {
  return { status: 'ok', service: 'Tailandia API', timestamp: new Date() }
})

// Webhook para recebimento de Pix
fastify.post('/webhook/pix', async (request, reply) => {
  const { txid, valor, status } = request.body
  // Emitir evento para o Redis para liberar o caixa
  fastify.log.info(`Recebido Pix TxID: ${txid}, Status: ${status}`)
  return { received: true }
})

// Rota simulada do PDV registrando um item
fastify.post('/pdv/scan', async (request, reply) => {
  const { ean, cashier_id } = request.body
  // Aqui enviamos para o Redis pub/sub para a IA parear com a câmera
  fastify.log.info(`Item Bipado: ${ean} no caixa ${cashier_id}`)
  return { success: true }
})

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    fastify.log.info(`API do PDV iniciada na porta 3000`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
