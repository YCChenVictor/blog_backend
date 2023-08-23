const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const randomColor = require('randomcolor')
const path = require('path')
const fs = require('fs')
const passport = require('../middleware/passport.js')

const nodeGraph = (app) => {
  app.get('/node-graph-init', passport.authenticate('jwt'), (req, res) => {
    res.status(200).json({ loggedIn: true })
  })

  app.get('/node-graph', async () => {
    // The problem is currently I did not host backend on production, so there is no way for frontend to get the data.
  })

  app.post('/node-graph', async (req, res) => {
    // I am going to use DFS concept to solve this graph like problem.
    const { category } = req.query
    const domain = 'http://localhost:3000'
    const queue = [`http://localhost:3000/blog/${category}/main`]
    const visited = new Set()
    const structure = {}
  
    function crawl(queue, visited, domain) { // Promise in this function
      const childNodes = []
      let url = queue.shift()
      if (!url) {
        return Promise.resolve(structure) // resolve with returning the final structure
      } else {
        if (!visited.has(url)) {
          visited.add(url)
          return new Promise(async (resolve, reject) => {
            const browser = await puppeteer.launch()
            const page = await browser.newPage()

            await page.goto(url, { waitUntil: 'networkidle2' })
            const html = await page.content()
            const $ = cheerio.load(html)
            $('a').each((i, link) => {
              const href = $(link).attr('href')
              if (href && href.startsWith('/blog/') && !href.includes('#')) {
                const absoluteUrl = domain + href
                childNodes.push(href)
                queue.push(absoluteUrl)
              }
            })
            const parentNode = url.replace(domain, "")
            structure[parentNode] = childNodes
            resolve(crawl(queue, visited, domain)) // resolve with calling this function again
          })
        } else {
          return crawl(queue, visited, domain)
        }
      }
    }

    function storeAsFile(result) {
      const filePath = `data/${category}/nodeGraph.json`
      // Convert JSON data to a string
      const jsonString = JSON.stringify(result)
    
      // Create the necessary directories if they don't exist
      const dirname = path.dirname(__dirname, filePath)

      if (!fs.existsSync(dirname)) {
        fs.mkdir(dirname, { recursive: true })
      }

      // Write the JSON data to a file
      fs.writeFile(filePath, jsonString, function (err) {
        if (err) throw err
      })
      console.log('Saved!')
    }
    
    function desiredFormat(structure) {
      console.log(structure)
      let nodes
      let links
      nodes = Object.keys(structure).map((value, index) => {
        let name
        const matches = value.match(/\/([^\/]+)\.html$/)
        if(matches !== null) {
          name = matches[1]
        } else {
          name = value
        }
        return {
          id: index + 1,
          name: name,
          url: value,
          group: getGroupFrom(value),
        }
      })
      nodes = giveColorByGroupTo(nodes)
      links = Object.entries(structure).map(([key, value]) => {
        return value.map((item) => {
          const source = getIdFromNodeName(key)
          const target = getIdFromNodeName(item)
          if(source && target) {
            return {source: source, target: target}
          }
        })
      }).flat().filter(obj => obj !== undefined)
    
      function getIdFromNodeName(url) { // It will get link from node
        result = nodes.find(node => node.url === url)
        if(result) {
          return result['id']
        } else {
          null
        }
      }
    
      function getGroupFrom(url) {
        return url.split("/")[2]
      }
    
      function giveColorByGroupTo(nodes) {
        const groups = [...new Set(nodes.map(node => node.group))]
        const colors = randomColor({ count: groups.length })
        nodes.map((node) => {
          node.color = colors[groups.indexOf(node.group)]
        })
        return nodes
      }
    
      return { nodes: nodes, links: links }
    }
  
    crawl(queue, visited, domain)
      .then((structure) => {
        storeAsFile(desiredFormat(structure))
      })
      .catch((error) => {
        console.error('Error occurred during crawling:', error);
      });
  })
};

module.exports = nodeGraph;