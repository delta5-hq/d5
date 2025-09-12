import Router from '@koa/router'
import MacroController from '../controllers/MacroController'

const macroRouter = new Router({prefix: '/macro'})

macroRouter
  .post('/', MacroController.create)
  .get('/', MacroController.list)
  .get('/:name/name', MacroController.getByName)
  .use('/:macroId', MacroController.load)
  .get('/:macroId', MacroController.get)
  .delete('/:macroId', MacroController.delete)

export default macroRouter
