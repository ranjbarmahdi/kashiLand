const { getBrowser, getRandomElement, delay, checkMemoryUsage, getCpuUsagePercentage } = require('./utils')
const omitEmpty = require('omit-empty');
const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const db = require('./config.js');
const path = require("path");
const fs = require("fs");
const os = require('os');
// const cron = require('node-cron');
// const CronJob = require('cron').CronJob;






// ============================================ DB
async function removeUrl() {
     const existsQuery = `
        SELECT * FROM unvisited u 
        limit 1
    `
     const deleteQuery = `
          DELETE FROM unvisited 
          WHERE id=$1
     `
     try {
          const urlRow = await db.oneOrNone(existsQuery);
          if (urlRow) {
               await db.query(deleteQuery, [urlRow.id])
          }
          return urlRow;
     } catch (error) {
          console.log("we have no url", error);
     }
}

async function insertProduct(queryValues) {
     const query = `
          insert into products ("url", "xpath", "specifications", "description", "price", "unitofmeasurement", "category", "brand", "sku", "name", "row")
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     `;

     try {
          const result = await db.oneOrNone(query, queryValues);
          return result;
     } catch (error) {
          console.log("Error in insertProduct :", error.message);
     }
}

async function insertUrlToProblem(url) {
     const existsQuery = `
        SELECT * FROM problem u 
        where "url"=$1
    `

     const insertQuery = `
        INSERT INTO problem ("url")
        VALUES ($1)
        RETURNING *;
    `
     const urlInDb = await db.oneOrNone(existsQuery, [url])
     if (!urlInDb) {
          try {
               const result = await db.query(insertQuery, [url]);
               return result;
          } catch (error) {
               console.log(`Error in insertUrlToProblem  function : ${url}\nError:`, error.message);
          }
     }
}

async function insertUrlToVisited(url) {
     const existsQuery = `
        SELECT * FROM visited u 
        where "url"=$1
    `

     const insertQuery = `
        INSERT INTO visited ("url")
        VALUES ($1)
        RETURNING *;
    `
     const urlInDb = await db.oneOrNone(existsQuery, [url])
     if (!urlInDb) {
          try {
               const result = await db.query(insertQuery, [url]);
               return result;
          } catch (error) {
               console.log(`Error in insertUrlToVisited function : ${url}\nError:`, error.message);
          }
     }
}


// ============================================ scrapSingleProduct
async function scrapSingleProduct(page, productURL, imagesDIR, documentsDir, rowNumber = 1) {
     try {
          console.log(`======================== Start scraping : \n${productURL}\n`);
          await page.goto(productURL, { timeout: 180000 });

          await delay(5000);

          const html = await page.content();
          const $ = await cheerio.load(html);

          const data = {};
          data["title"] = $('h1.product-title').length ? $('h1.product-title').text().trim() : "";
          data["category"] = $('.product-category').last().length
               ? $('.product-category').last()
                    .map((i, a) => $(a).text().trim()).get().join(" > ")
               : "";

          data["brand"] = $('#productdetail  div.well.well-sm > div.text-justify.product-summary > ul > li:nth-child(2) > a').text()?.trim() || '';

          data['unitOfMeasurement'] = 'عدد'
          data["price"] = "";
          data["xpath"] = "";

          const offPercent = $('notFound').get()
          if (offPercent.length) {
               data["price"] = $('notFound').text().replace(/[^\u06F0-\u06F90-9]/g, "")
               data["xpath"] = "";
          }
          else {
               data["price"] = $('div[class=price-box] .pricefi').first().text().replace(/[^\u06F0-\u06F90-9]/g, "")
               data["xpath"] = '/html/body/form/div[3]/div/section/div[7]/div/div/div/div/div/div/div/div/div/div/div[1]/div[2]/div[2]/div[2]/div[2]/div[1]/div[3]/div/div[1]/div[1]/span[2]/text()';
          }

          // specification, specificationString
          let specification = {};
          const rowElements = $('.c-params__list > li')
          for (let i = 0; i < rowElements.length; i++) {
               const row = rowElements[i];
               if ($(row).find('>div').length) {
                    const key = $(row).find('> div.c-params__list-key').text()?.trim()
                    const value = $(row).find('> div.c-params__list-value').text()?.trim()
                    specification[key] = value;
               }
          }
          specification = omitEmpty(specification);
          const specificationString = Object.keys(specification).map((key) => `${key} : ${specification[key]}`).join("\n");

          // descriptionString
          const descriptionString = $('notFound')
               .map((i, e) => $(e).text()?.trim())
               .get()
               .join('/n');

          // Generate uuidv4
          const uuid = uuidv4().replace(/-/g, "");

          // Download Images
          // let imagesUrls = $('img.mss-selector-thumbnails')
          //      .map((i, img) => $(img).attr("src").replace(/(-[0-9]+_[0-9]+)/g, "600_600")).get();
          let imagesUrls = $('img.mss-selector-thumbnails')
               .map((i, img) => $(img).attr("src").replace(/\d{3}_\d{3}/g, "600_600")).get();
          imagesUrls = Array.from(new Set(imagesUrls));
          for (let i = 0; i < imagesUrls.length; i++) {
               try {
                    const imageUrl = imagesUrls[i];
                    const response = await fetch(imageUrl);

                    if (response.ok) {
                         const buffer = await response.buffer();
                         const imageType = path.extname(imageUrl);
                         const localFileName = `${uuid}-${i + 1}${imageType}`;
                         const imageDir = path.normalize(
                              imagesDIR + "/" + localFileName
                         );
                         fs.writeFileSync(imageDir, buffer);
                    }
               } catch (error) {
                    console.log("Error In Download Images", error);
               }
          }


          // download pdfs
          let pdfUrls = $('NotFound').map((i, e) => $(e).attr('href')).get().filter(href => href.includes('pdf'))
          pdfUrls = Array.from(new Set(pdfUrls))
          for (let i = 0; i < pdfUrls.length; i++) {
               try {
                    const pdfUrl = imagesUrls[i];
                    const response = await fetch(pdfUrl);
                    if (response.ok) {
                         const buffer = await response.buffer();
                         const localFileName = `${uuid}-${i + 1}.pdf`;
                         const documentDir = path.normalize(documentsDir + "/" + localFileName);
                         fs.writeFileSync(documentDir, buffer);
                    }
               } catch (error) {
                    console.log("Error In Download Documents", error);
               }
          }


          // Returning Tehe Required Data For Excel
          const productExcelDataObject = {
               URL: productURL,
               xpath: data["xpath"],
               specifications: specificationString,
               description: descriptionString,
               price: data["price"],
               unitOfMeasurement: data['unitOfMeasurement'],
               category: data["category"],
               brand: data["brand"],
               SKU: uuid,
               name: data["title"],
               row: rowNumber
          };

          return productExcelDataObject;
     } catch (error) {
          console.log("Error In scrapSingleProduct in page.goto", error);
          await insertUrlToProblem(productURL);
          return null;
     }

}


// ============================================ Main
async function main() {
     let urlRow;
     let browser;
     let page;
     try {
          const DATA_DIR = path.normalize(__dirname + "/kashiLand");
          const IMAGES_DIR = path.normalize(DATA_DIR + "/images");
          const DOCUMENTS_DIR = path.normalize(DATA_DIR + "/documents");


          // Create SteelAlborz Directory If Not Exists
          if (!fs.existsSync(DATA_DIR)) { fs.mkdirSync(DATA_DIR); }
          if (!fs.existsSync(DOCUMENTS_DIR)) { fs.mkdirSync(DOCUMENTS_DIR); }
          if (!fs.existsSync(IMAGES_DIR)) { fs.mkdirSync(IMAGES_DIR); }

          // get random proxy
          const proxyList = [''];
          const randomProxy = getRandomElement(proxyList);

          // Lunch Browser
          browser = await getBrowser(randomProxy, true, false);
          page = await browser.newPage();
          await page.setViewport({
               width: 1920,
               height: 1080,
          });


          // get product page url from db
          urlRow = await removeUrl();

          if (urlRow?.url) {
               const productInfo = await scrapSingleProduct(page, urlRow.url, IMAGES_DIR, DOCUMENTS_DIR);
               const insertQueryInput = [
                    productInfo.URL,
                    productInfo.xpath,
                    productInfo.specifications,
                    productInfo.description,
                    productInfo.price,
                    productInfo.unitOfMeasurement,
                    productInfo.category,
                    productInfo.brand,
                    productInfo.SKU,
                    productInfo.name,
                    productInfo.row
               ];

               // if exists productInfo insert it to products
               if (productInfo) {
                    await insertProduct(insertQueryInput);
                    await insertUrlToVisited(urlRow?.url);
               }

          }

     }
     catch (error) {
          console.log("Error In main Function", error);
          await insertUrlToProblem(urlRow?.url);
     }
     finally {
          // Close page and browser
          console.log("End");
          await page.close();
          await browser.close();
          await delay(1000);
     }
}


// ============================================ Job

// stopTime = 8000
// let job = new CronJob('*/3 * * * * *', async () => {

//      console.log("cron");
//      let usageMemory = (os.totalmem() - os.freemem()) / (1024 * 1024 * 1024); 
//      let memoryUsagePercentage = checkMemoryUsage();
//      let cpuUsagePercentage = await getCpuUsagePercentage();


//      if (usageMemory >= 13 || cpuUsagePercentage >= 90) {
//           console.log("=========================================");
//           console.log(`job stopped for ${stopTime} ms`);
//           job.stop();

//           setInterval(() => {
//                console.log(`Restarting cron job after ${stopTime} ms...`)
//                job.start();
//           }, stopTime)
//      } 


//      if (memoryUsagePercentage <= 80 && cpuUsagePercentage <= 85) {
//           main();
//           console.log("main");
//      }

// })

// job.start()

let usageMemory = (os.totalmem() - os.freemem()) / (1024 * 1024 * 1024);
let memoryUsagePercentage = checkMemoryUsage();
let cpuUsagePercentage = getCpuUsagePercentage();

if (memoryUsagePercentage <= 85 && cpuUsagePercentage <= 80 && usageMemory <= 28) {
     main();
}
else {
     const status = `status:
     memory usage = ${usageMemory}
     percentage of memory usage = ${memoryUsagePercentage}
     percentage of cpu usage = ${cpuUsagePercentage}\n`

     console.log("main function does not run.\n");
     console.log(status);
}






