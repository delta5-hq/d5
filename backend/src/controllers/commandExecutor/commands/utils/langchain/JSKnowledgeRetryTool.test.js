import {JSKnowledgeRetryTool} from './JSKnowledgeRetryTool'
import {JSKnowledgeMapSearch} from './JSKnowledgeMapSearch'

describe('JSKnowledgeRetryTool', () => {
  it('should return converted outline after 3 attempts', async () => {
    const llm = {}
    const options = {}
    const searchTool = new JSKnowledgeMapSearch(llm, options)
    const tool = new JSKnowledgeRetryTool(searchTool, {retry: 10})

    const convertSpyOn = jest.spyOn(searchTool, 'convertOutput').mockResolvedValue('outline')
    const validateSpyOn = jest.spyOn(tool, 'validateOutline')

    validateSpyOn.mockReturnValueOnce(false)
    validateSpyOn.mockReturnValueOnce(false)
    validateSpyOn.mockReturnValueOnce(false)
    validateSpyOn.mockReturnValueOnce(true)

    await tool.convertWithRetry('result')

    expect(convertSpyOn).toHaveBeenCalledTimes(4)

    convertSpyOn.mockRestore()
    validateSpyOn.mockRestore()
  })
})
