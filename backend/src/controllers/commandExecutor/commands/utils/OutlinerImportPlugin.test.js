import {OutlinerImportPlugin} from './createNodes'

const validData = `
title
  subtitle1
    card1
    card2
    card3 with some more text
  subtitle2

    card4
    card5
      subsubsub...
  subtitle3
    card6
anotherTitle
`

const validDataTab = validData.replace(/ {2}/g, '\t')

const DEBUG_TEXT =
  "The error message you're encountering indicates a permissions issue when Docker tries to copy the `settings.js` file from the Node-RED container to the host directory mapped to `/data`. The error code `EACCES` means that Docker doesn't have the necessary permissions to write to the specified directory on your host machine.\n" +
  '\n' +
  'To resolve this issue, you can follow these steps:\n' +
  '\n' +
  '1. **Check Directory Permissions**:\n' +
  '   Ensure that the `./data/nodered` directory on your host machine has the correct permissions set so that Docker can write to it. You can adjust the permissions using the following command:\n' +
  '\n' +
  '   ```bash\n' +
  '   sudo chown -R $(whoami):$(whoami) ./data/nodered\n' +
  '   sudo chmod -R 755 ./data/nodered\n' +
  '   ```\n' +
  '\n' +
  '   This will change the ownership of the directory to your user and grant read, write, and execute permissions to the owner.\n' +
  '\n' +
  '2. **Verify Volume Path**:\n' +
  '   Double-check that the volume path specified in your `docker-compose.yml` file is correct and that the directory exists on your host machine. If the directory does not exist, Docker might create it with root ownership, which can cause permission issues.\n' +
  '\n' +
  '3. **Use Docker Compose with Sudo**:\n' +
  '   If you are still facing permission issues, try running Docker Compose as root using `sudo`. This is generally not recommended for production environments, but it can help identify if the issue is related to user permissions:\n' +
  '\n' +
  '   ```bash\n' +
  '   sudo docker-compose up\n' +
  '   ```\n' +
  '\n' +
  '4. **Check SELinux**:\n' +
  '   If you are using a Linux distribution with SELinux enabled (such as Fedora or CentOS), SELinux might be preventing Docker from writing to the host directory. You can temporarily disable SELinux to see if it resolves the issue:\n' +
  '\n' +
  '   ```bash\n' +
  '   sudo setenforce 0\n' +
  '   ```\n' +
  '\n' +
  '   If this resolves the issue, you can create an SELinux policy to allow Docker to write to the directory without disabling SELinux entirely.\n' +
  '\n' +
  '5. **Consider Docker User**:\n' +
  "   If you're running Docker with a specific user or group, ensure that this user has the necessary permissions to access the directory on your host machine.\n" +
  '\n' +
  'After making these changes, try running your Docker Compose setup again and see if the issue is resolved.'

describe('OutlinerImporterPlugin', () => {
  Object.entries({spaces: validData, tabs: validDataTab}).forEach(([name, data]) => {
    it(`should handle input data with ${name} correctly`, async () => {
      const plugin = new OutlinerImportPlugin()

      const nodeDatas = await plugin.transform(data)

      expect(nodeDatas.length).toBe(2)

      const [{root, nodes, edges}, secondBlock] = nodeDatas

      expect(root).toBeDefined()
      expect(edges && Object.values(edges).length).toBeFalsy()
      expect(nodes[root].title).toBe('title')
      expect(nodes[root].children?.length).toBe(3)
      const rootChildren = nodes[root].children
      expect(rootChildren).toBeDefined()

      rootChildren.forEach((id, i) => {
        expect(nodes[id]?.title).toBe(`subtitle${i + 1}`)
      })
      expect(nodes[rootChildren[0]].children?.length).toBe(3)
      expect(nodes[rootChildren[1]].children?.length).toBe(2)
      expect(nodes[rootChildren[2]].children?.length).toBe(1)

      let subSubChildCount = 0
      rootChildren.forEach(subChildId => {
        const subChildren = nodes[subChildId].children

        expect(subChildren).toBeDefined()

        subChildren.forEach(subSubChildId => {
          subSubChildCount += 1
          expect(nodes[subSubChildId].title).toContain(`card${subSubChildCount}`)
        })
      })
      expect(subSubChildCount).toBe(6)

      expect(secondBlock.nodes[secondBlock.root].title).toBe('anotherTitle')
    })
  })

  it('should handle text with markdown', async () => {
    const plugin = new OutlinerImportPlugin()

    const nodeDatas = await plugin.transform(DEBUG_TEXT)

    expect(nodeDatas.length).toBe(8)
    expect(Object.keys(nodeDatas[1].nodes).length).toBe(1)
    expect(Object.keys(nodeDatas[2].nodes).length).toBe(7)
    expect(Object.keys(nodeDatas[3].nodes).length).toBe(2)
    expect(Object.keys(nodeDatas[4].nodes).length).toBe(5)
    expect(Object.keys(nodeDatas[5].nodes).length).toBe(6)
    expect(Object.keys(nodeDatas[6].nodes).length).toBe(2)
    expect(Object.keys(nodeDatas[7].nodes).length).toBe(1)
  })
})
