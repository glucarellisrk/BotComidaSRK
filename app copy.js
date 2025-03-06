// IMPORTAMOS LOS MÓDULOS NECESARIOS
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode'); // Se usa para generar el Data URL del QR
const cron = require('node-cron');
const axios = require('axios');

// Archivo donde se persisten los datos de la encuesta y los votos
const POLL_DATA_FILE = './pollData.json';
const VOTES_FILE = './votes.json';


//////////////////////////////////////////////////
// Estructura para almacenar datos de ensaladas //
//////////////////////////////////////////////////
// Nueva estructura para almacenar ensaladas
const SALAD_DATA_FILE = './saladData.json';
let salads = {};

if (fs.existsSync(SALAD_DATA_FILE)) {
  salads = JSON.parse(fs.readFileSync(SALAD_DATA_FILE));
}

// Estados para el flujo de ensaladas
const saladSteps = {
  INGREDIENTS: 1,
  COMPLEMENTS: 2,
  ADEREZOS: 3,
  TOPPINGS: 4
};

// Mapeo de opciones válidas
const saladOptions = {
  ingredients: ["Hojas Verdes", "Tomate", "Zanahoria", "Cebolla", "Apio", "Arroz", "Fideos", "Repollo", "Huevo", "Remolacha", "Espinaca"],
  complements: ["Pollo", "Kani Kama", "Pimiento", "Queso Rallado", "Jamon", "Queso", "Choclo", "Peceto", "Gajos de Naranja", "Atun"],
  aderezos: ["Limon", "Sal", "Mayonesa", "Mostaza"],
  toppings: ["Semillas de Sesamo", "Semillas de Sesamo Integral"]
};

////////////////////////////////////////////////////


// Función para generar la estructura de votos para un día (por opción y local)
function createVotesStructure() {
  return {
    "1": { "ComeSano": [], "Indigo": [] },
    "2": { "ComeSano": [], "Indigo": [] },
    "3": { "ComeSano": [], "Indigo": [] },
    "4": { "ComeSano": [], "Indigo": [] },
    "5": { "ComeSano": [] } // Nueva línea para la opción 5
  };
}

// Cargamos los datos de la encuesta desde el archivo (si existe) o usamos valores por defecto 
let weeklyPollData;
if (fs.existsSync(POLL_DATA_FILE)) {
  try {
    weeklyPollData = JSON.parse(fs.readFileSync(POLL_DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Error al leer pollData.json, se usarán los valores por defecto:', err);
    weeklyPollData = {
      lunes: {
        "ComeSano": { "1": "", "2": "", "3": "", "4": "", "5": "Arma tu Ensalada" },
        "Indigo": { "1": "", "2": "", "3": "" } // Indigo tiene 3 opciones
      },
      martes: {
        "ComeSano": { "1": "", "2": "", "3": "", "4": "", "5": "Arma tu Ensalada" },
        "Indigo": { "1": "", "2": "", "3": "" }
      },
      miercoles: {
        "ComeSano": { "1": "", "2": "", "3": "", "4": "", "5": "Arma tu Ensalada" },
        "Indigo": { "1": "", "2": "", "3": "" }
      },
      jueves: {
        "ComeSano": { "1": "", "2": "", "3": "", "4": "", "5": "Arma tu Ensalada" },
        "Indigo": { "1": "", "2": "", "3": "" }
      },
      viernes: {
        "ComeSano": { "1": "", "2": "", "3": "", "4": "", "5": "Arma tu Ensalada" },
        "Indigo": { "1": "", "2": "", "3": "" }
      }
    };
  }
} else {
  // Si no existe pollData.json, usar estos valores vacíos
  weeklyPollData = {
    lunes: {
      "ComeSano": { 
        "1": "", 
        "2": "", 
        "3": "", 
        "4": "", 
        "5": "Arma tu Ensalada" // Agregar esta línea
      },
      "Indigo": { "1": "", "2": "", "3": "" }
    },
    // Repetir el mismo patrón para otros días
    martes: {
      "ComeSano": { 
        "1": "", 
        "2": "", 
        "3": "", 
        "4": "", 
        "5": "Arma tu Ensalada" 
      },
      "Indigo": { "1": "", "2": "", "3": "" }
    },
    miercoles: {
      "ComeSano": { 
        "1": "", 
        "2": "", 
        "3": "", 
        "4": "", 
        "5": "Arma tu Ensalada" 
      },
      "Indigo": { "1": "", "2": "", "3": "" }
    },
    jueves: {
      "ComeSano": { 
        "1": "", 
        "2": "", 
        "3": "", 
        "4": "", 
        "5": "Arma tu Ensalada" 
      },
      "Indigo": { "1": "", "2": "", "3": "" }
    },
    viernes: {
      "ComeSano": { 
        "1": "", 
        "2": "", 
        "3": "", 
        "4": "", 
        "5": "Arma tu Ensalada" 
      },
      "Indigo": { "1": "", "2": "", "3": "" }
    }
  };
}

// Cargamos los votos (si existen) o inicializamos en blanco con la nueva estructura
let votes;
if (fs.existsSync(VOTES_FILE)) {
  try {
    votes = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));
  } catch (err) {
    console.error('Error al leer votes.json, se inicializan los votos en blanco:', err);
    votes = {
      lunes: createVotesStructure(),
      martes: createVotesStructure(),
      miercoles: createVotesStructure(),
      jueves: createVotesStructure(),
      viernes: createVotesStructure()
    };
  }
} else {
  votes = {
    lunes: createVotesStructure(),
    martes: createVotesStructure(),
    miercoles: createVotesStructure(),
    jueves: createVotesStructure(),
    viernes: createVotesStructure()
  };
}

// Función para guardar los votos en archivo
function saveVotes() {
  fs.writeFile(VOTES_FILE, JSON.stringify(votes, null, 2), (err) => {
    if (err) console.error('Error al guardar votes.json:', err);
    else console.log('Votos guardados correctamente.');
  });
}

// Mapeo de números de día a nombre (getDay(): 0 = domingo, 1 = lunes, ..., 6 = sábado)
const dayNames = {
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes'
};

// ----------------------------
// CONFIGURACIÓN DEL SERVIDOR EXPRESS
// ----------------------------
const app = express();
const port = 3000;
app.use(bodyParser.urlencoded({ extended: true }));

// Ruta GET raíz: muestra el menú principal con un GIF aleatorio y el botón Configurar Bot
app.get('/', async (req, res) => {
  try {
    // Obtener el GIF y la trivia en paralelo
    const [gifResponse, triviaResponse] = await Promise.all([
      axios.get('https://api.giphy.com/v1/gifs/random', {
        params: {
          api_key: 'icrRFMMx3jzGXRIueRXJPnrYy7xj3IlD', // Tu API Key de Giphy
          tag: 'food',
          rating: 'G'
        }
      }),
      axios.get('https://api.spoonacular.com/food/trivia/random', {
        params: {
          apiKey: '7da1565061e84bbfb31c48107f8960e9' // Tu API Key de Spoonacular
        }
      })
    ]);

    const randomGif = gifResponse.data.data.images.original.url;
    const foodTrivia = triviaResponse.data.text; // Trivia en inglés

    // Traducir la trivia al español usando el endpoint de Google Translate
    const googleTranslateResponse = await axios.get('https://translate.googleapis.com/translate_a/single', {
      params: {
        client: 'gtx',
        dt: 't',    // Solicita el resultado de la traducción
        sl: 'auto', // Detecta automáticamente el idioma fuente
        tl: 'es',   // Traduce al español
        q: foodTrivia
      }
    });

    // Concatenar todos los segmentos traducidos
    let translatedTrivia = googleTranslateResponse.data[0]
      .map(segment => segment[0])
      .join('');

    // Limpiar el fragmento no deseado (adsbygoogle...)
    translatedTrivia = translatedTrivia.replace(/\(adsbygoogle\s*=\s*window\.adsbygoogle\s*\|\|\s*\[\]\)\.push\(\{\}\)/gi, '').trim();

    res.send(`
      <html>
        <head>
          <title>Sistema de Encuestas</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 2em;
              background: linear-gradient(135deg, #f6f9fc, #e9eff5);
              color: #333;
              text-align: center;
            }
            h1 {
              color: #2c3e50;
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              margin: 10px;
              padding: 15px 30px;
              background-color: #2980b9;
              color: #fff;
              border-radius: 5px;
              text-decoration: none;
              font-size: 1.2em;
              transition: background-color 0.3s;
            }
            .button:hover {
              background-color: #1c5980;
            }
            .button.disabled {
              background-color: #ccc;
              color: #999;
              pointer-events: none;
            }
            .menu {
              margin-top: 30px;
            }
            .footer-fun {
              margin-top: 40px;
              font-style: italic;
              color: #555;
            }
            .footer-fun img {
              max-width: 400px;
              border-radius: 10px;
            }
          </style>
        </head>
        <body>
          <h1>¡Bienvenido al Sistema de Pedido Comida SRK!</h1>
          <div class="menu">
            <a class="button" href="/update-poll">Actualizar Encuesta</a>
            <a class="button" href="/results">Ver Resultados</a>
            <a class="button disabled" href="#">Configurar Bot</a>
          </div>
          <div class="footer-fun">
            <img src="${randomGif}" alt="GIF Aleatorio" />
            <p>¡Disfruta de este GIF aleatorio! Recuerda: <strong>${translatedTrivia}</strong></p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error al obtener datos:', error);
    res.send('Error al obtener el GIF o la trivia.');
  }
});

// Ruta GET: Configurar Bot - muestra el QR y mensaje de configuración exitosa
app.get('/configurar-bot', (req, res) => {
  if (!latestQR) {
    return res.send(`
      <html>
        <head>
          <title>Configurar Bot</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin: 2em; background: #f0f8ff; }
            .button { margin-top: 20px; padding: 10px 20px; background: #2980b9; color: #fff; border: none; border-radius: 5px; text-decoration: none; }
          </style>
        </head>
        <body>
          <h1>Configurar Bot</h1>
          <p>Aún no se ha generado ningún QR. Intenta reiniciar el bot.</p>
          <a class="button" href="/">Volver al inicio</a>
        </body>
      </html>
    `);
  }
  // Generar Data URL del QR
  QRCode.toDataURL(latestQR, (err, url) => {
    if (err) {
      console.error('Error generando QR:', err);
      return res.send('Error generando el QR.');
    }
    res.send(`
      <html>
        <head>
          <title>Configurar Bot</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin: 2em; background: #f0f8ff; }
            .button { margin-top: 20px; padding: 10px 20px; background: #2980b9; color: #fff; border: none; border-radius: 5px; text-decoration: none; }
          </style>
        </head>
        <body>
          <h1>Configurar Bot</h1>
          <p>Escanea el siguiente código QR con tu WhatsApp para iniciar sesión:</p>
          <img src="${url}" alt="QR Code" />
          <p>La configuración fue correcta.</p>
          <a class="button" href="/">Volver al inicio</a>
        </body>
      </html>
    `);
  });
});

// Ruta GET: Muestra el formulario para actualizar la encuesta con estilo
app.get('/update-poll', (req, res) => {
  let formHTML = `
    <html>
      <head>
        <title>Actualizar Encuesta Semanal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background: #f0f8ff;
            color: #34495e;
          }
          h1 { text-align: center; color: #2c3e50; }
          .days-container { 
            display: flex; 
            flex-wrap: wrap; 
            gap: 20px;
            justify-content: center;
          }
          .day-card { 
            background: #ecf0f1; 
            padding: 15px; 
            border-radius: 8px; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.1); 
            min-width: 280px;
            flex: 1 1 calc(33% - 40px);
          }
          .day-card h2 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { padding: 8px; text-align: center; border: 1px solid #bdc3c7; }
          input[type="text"] { 
            width: 90%; 
            padding: 5px; 
            border: 1px solid #bdc3c7; 
            border-radius: 3px; 
          }
          .submit-container { text-align: center; margin-top: 20px; }
          input[type="submit"] { 
            padding: 10px 20px; 
            background: #2980b9; 
            color: #fff; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer;
          }
          input[type="submit"]:hover { background: #1c5980; }
          @media (max-width: 768px) {
            .day-card { flex: 1 1 100%; }
          }
        </style>
      </head>
      <body>
        <h1>Actualizar Datos de la Encuesta Semanal</h1>
        <form method="POST" action="/update-poll">
          <div class="days-container">
  `;
  ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].forEach(day => {
    formHTML += `
      <div class="day-card">
        <h2>${day.charAt(0).toUpperCase() + day.slice(1)}</h2>
        <table>
          <thead>
            <tr>
              <th>ComeSano</th>
              <th>Indigo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><input type="text" name="${day}_C1" value="${weeklyPollData[day]["ComeSano"]["1"]}" required></td>
              <td><input type="text" name="${day}_I1" value="${weeklyPollData[day]["Indigo"]["1"]}" required></td>
            </tr>
            <tr>
              <td><input type="text" name="${day}_C2" value="${weeklyPollData[day]["ComeSano"]["2"]}" required></td>
              <td><input type="text" name="${day}_I2" value="${weeklyPollData[day]["Indigo"]["2"]}" required></td>
            </tr>
            <tr>
              <td><input type="text" name="${day}_C3" value="${weeklyPollData[day]["ComeSano"]["3"]}" required></td>
              <td><input type="text" name="${day}_I3" value="${weeklyPollData[day]["Indigo"]["3"]}" required></td>
            </tr>
            <tr>
              <td><input type="text" name="${day}_C4" value="${weeklyPollData[day]["ComeSano"]["4"]}" required></td>
              <td></td> <!-- Celda vacía para Indigo -->
            </tr>
          </tbody>
        </table>
      </div>
    `;
  });
  formHTML += `
          </div>
          <div class="submit-container">
            <input type="submit" value="Actualizar Encuesta">
          </div>
        </form>
        <p style="text-align:center;"><a href="/">Volver al inicio</a></p>
      </body>
    </html>
  `;
  res.send(formHTML);
});

// Ruta POST: Actualiza los datos de la encuesta
app.post('/update-poll', (req, res) => {
  ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].forEach(day => {
    weeklyPollData[day]["ComeSano"]["1"] = req.body[`${day}_C1`];
    weeklyPollData[day]["ComeSano"]["2"] = req.body[`${day}_C2`];
    weeklyPollData[day]["ComeSano"]["3"] = req.body[`${day}_C3`];
    weeklyPollData[day]["ComeSano"]["4"] = req.body[`${day}_C4`];
    weeklyPollData[day]["Indigo"]["1"] = req.body[`${day}_I1`];
    weeklyPollData[day]["Indigo"]["2"] = req.body[`${day}_I2`];
    weeklyPollData[day]["Indigo"]["3"] = req.body[`${day}_I3`];
    weeklyPollData[day]["Indigo"]["4"] = req.body[`${day}_I4`];
  });
  fs.writeFile(POLL_DATA_FILE, JSON.stringify(weeklyPollData, null, 2), (err) => {
    if (err) console.error('Error al guardar pollData.json:', err);
    else console.log('Datos de la encuesta actualizados y guardados.');
  });
  res.send(`
    <html>
      <head>
        <title>Encuesta Actualizada</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            background: #f0f8ff; 
            color: #2c3e50; 
            text-align: center; 
            margin: 20px;
          }
          a { text-decoration: none; color: #2980b9; font-size: 1.2em; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>Datos de la encuesta actualizados correctamente!</h1>
        <p><a href="/">Volver al inicio</a></p>
      </body>
    </html>
  `);
});

// Ruta GET: Muestra los resultados de la encuesta para el día actual
app.get('/results', (req, res) => {
  const now = new Date();
  const dayNumber = now.getDay();
  if (dayNumber < 1 || dayNumber > 5) {
    res.send(`
      <html>
        <!-- ... (mantener HTML existente para días no hábiles) -->
    `);
    return;
  }

  const dayName = dayNames[dayNumber]; 
  const currentVotes = votes[dayName];

  let resultHTML = `
    <html>
      <head>
        <title>Resultados de la Encuesta</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background: #f0f8ff;
            color: #2c3e50;
            text-align: center;
          }
          h1 { 
            background-color: #ffe6e6; 
            text-align: center; 
            padding: 10px; 
            border-radius: 5px;
            margin-bottom: 30px;
          }
          table { 
            width: 100%; 
            max-width: 800px;
            margin: 20px auto; 
            border-collapse: collapse; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          th, td { 
            padding: 12px; 
            text-align: center; 
            border: 1px solid #bdc3c7; 
          }
          thead tr {
            color: white;
          }
          .come-sano th {
            background-color: #27ae60; /* Verde */
          }
          .indigo th {
            background-color: #e67e22; /* Naranja */
          }
          .salad-section {
            margin-top: 40px;
          }
          .salad-table th {
            background-color: #27ae60;
          }
          a {
            text-decoration: none; 
            color: #2980b9; 
            font-weight: bold;
            margin-top: 20px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <h1>RESULTADOS ${dayName.toUpperCase()}</h1>

        <!-- Tabla para COME SANO -->
        <table class="come-sano">
          <thead>
            <tr>
              <th colspan="2">COME SANO</th>
            </tr>
            <tr>
              <th>Opción</th>
              <th>Votos</th>
            </tr>
          </thead>
          <tbody>
  `;

  ["1","2","3","4","5"].forEach(option => {
    const comidaCS = weeklyPollData[dayName]["ComeSano"][option] || "Arma tu Ensalada"; // Fallback por si no existe
    const votosCS = (currentVotes[option]?.["ComeSano"] || []).length;
    
    resultHTML += `
      <tr>
        <td>${comidaCS}</td>
        <td>${votosCS}</td>
      </tr>
    `;
  });

  resultHTML += `
          </tbody>
        </table>

        <!-- Tabla para INDIGO -->
        <table class="indigo">
          <thead>
            <tr>
              <th colspan="2">INDIGO</th>
            </tr>
            <tr>
              <th>Opción</th>
              <th>Votos</th>
            </tr>
          </thead>
          <tbody>
  `;

  ["1","2","3"].forEach(option => {
    const comidaI = weeklyPollData[dayName]["Indigo"][option];
    const votosI = (currentVotes[option]?.["Indigo"] || []).length;
    resultHTML += `
      <tr>
        <td>${comidaI}</td>
        <td>${votosI}</td>
      </tr>
    `;
  });

  resultHTML += `
          </tbody>
        </table>

        <!-- Sección de Ensaladas -->
        <div class="salad-section">
          <h2>Ensaladas Personalizadas (${salads[dayName]?.length || 0})</h2>
          <table class="salad-table">
            <thead>
              <tr>
                <th>Ingredientes</th>
                <th>Complementos</th>
                <th>Aderezos</th>
                <th>Toppings</th>
              </tr>
            </thead>
            <tbody>
  `;

  if (salads[dayName] && salads[dayName].length > 0) {
    salads[dayName].forEach((salad, index) => {
      resultHTML += `
        <tr>
          <td>${salad.ingredients.join(', ')}</td>
          <td>${salad.complements.join(', ')}</td>
          <td>${salad.aderezos.join(', ')}</td>
          <td>${salad.toppings.join(', ')}</td>
        </tr>
      `;
    });
  } else {
    resultHTML += `<tr><td colspan="4">No hay ensaladas registradas hoy</td></tr>`;
  }

  resultHTML += `
            </tbody>
          </table>
        </div>

        <a href="/">Volver al inicio</a>
      </body>
    </html>
  `;

  res.send(resultHTML);
});

app.get('/export/txt', (req, res) => {
  const local = req.query.local;
  if (!local || (local !== 'ComeSano' && local !== 'Indigo')) {
    return res.status(400).send("Debe indicar un local válido (?local=ComeSano o ?local=Indigo).");
  }

  const now = new Date();
  const dayNumber = now.getDay();
  if (dayNumber < 1 || dayNumber > 5) {
    return res.send("No hay encuesta activa hoy.");
  }
  const dayName = dayNames[dayNumber];

  let content = `Resultados de la Encuesta para ${local} - ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}\n\n`;
  
  if (local === 'ComeSano') {
    ["1", "2", "3", "4"].forEach(option => {
      const comida = weeklyPollData[dayName][local][option];
      const votos = (votes[dayName][option][local] ? votes[dayName][option][local].length : 0);
      content += `Opción ${option}: ${comida} - Votos: ${votos}\n`;
    });
  } else if (local === 'Indigo') {
    ["1", "2", "3"].forEach(option => { // Solo 3 opciones para Indigo
      const comida = weeklyPollData[dayName][local][option];
      const votos = (votes[dayName][option][local] ? votes[dayName][option][local].length : 0);
      content += `Opción ${option}: ${comida} - Votos: ${votos}\n`;
    });
  }
  
  res.setHeader('Content-disposition', `attachment; filename=${local}_${dayName}_resultados.txt`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(content);
});

// Iniciamos el servidor Express
app.listen(port, () => {
  console.log(`Servidor web iniciado en http://localhost:${port}`);
});

// ----------------------------
// CONFIGURACIÓN DE WHATSAPP WEB CON LocalAuth
// ----------------------------
let latestQR = null; // Variable para almacenar el último QR generado

const client = new Client({
  authStrategy: new LocalAuth(),
  cacheEnabled: false,
  puppeteer: { headless: true, args: ['--no-sandbox'] }
});

client.on('qr', (qr) => {
  qrcodeTerminal.generate(qr, { small: true });
  console.log('Escanea el QR con tu WhatsApp para iniciar sesión.');
  latestQR = qr;
});

client.on('ready', () => {
  console.log('Cliente de WhatsApp listo!');
  cron.schedule('20 10 * * 1-5', () => {
    console.log('Enviando encuesta diaria...');
    sendPoll();
  });
  cron.schedule('0 12 * * 5', () => {
    console.log('Reseteando la encuesta para la próxima semana...');
    resetWeeklyData();
  });
  // sendPoll(); // Descomenta para pruebas inmediatas
});

// Función para resetear los datos de la encuesta y los votos
function resetWeeklyData() {
  // Reset menús
  ['lunes','martes','miercoles','jueves','viernes'].forEach(dia => {
    weeklyPollData[dia]["ComeSano"] = { 
      "1": "", 
      "2": "", 
      "3": "", 
      "4": "", 
      "5": "Arma tu Ensalada" 
    };
    weeklyPollData[dia]["Indigo"] = { "1": "", "2": "", "3": "" };
  });

  // Reset votos
  votes = {
    lunes: createVotesStructure(),
    martes: createVotesStructure(),
    miercoles: createVotesStructure(),
    jueves: createVotesStructure(),
    viernes: createVotesStructure()
  };

  // Reset ensaladas
  salads = {}; 

  // Guardar cambios
  fs.writeFile(POLL_DATA_FILE, JSON.stringify(weeklyPollData, null, 2), (err) => {
    if (err) console.error('Error al guardar pollData.json:', err);
    else console.log('Menús reseteados correctamente.');
  });

  fs.writeFile(VOTES_FILE, JSON.stringify(votes, null, 2), (err) => {
    if (err) console.error('Error al guardar votes.json:', err);
    else console.log('Votos reseteados correctamente.');
  });

  // IMPORTANTE: Agregar manejo de errores para salads
  try {
    fs.writeFileSync(SALAD_DATA_FILE, JSON.stringify(salads, null, 2));
    console.log('Ensaladas reseteadas correctamente.');
  } catch (err) {
    console.error('Error al guardar saladData.json:', err);
  }
}

// Función que envía la encuesta del día según los datos actualizados
function sendPoll() {
  const now = new Date();
  const dayNumber = now.getDay();
  if (dayNumber < 1 || dayNumber > 5) {
    console.log("Hoy no es día de encuesta (solo de lunes a viernes).");
    return;
  }
  const dayName = dayNames[dayNumber];
  const pollText = `Elige la comida para hoy ${dayName}:\n\n` +
    `ComeSano:\n` +
    `1. ${weeklyPollData[dayName]["ComeSano"]["1"]}\n` +
    `2. ${weeklyPollData[dayName]["ComeSano"]["2"]}\n` +
    `3. ${weeklyPollData[dayName]["ComeSano"]["3"]}\n` +
    `4. ${weeklyPollData[dayName]["ComeSano"]["4"]}\n` +
    `5. ${weeklyPollData[dayName]["ComeSano"]["5"]}\n\n` + // Nueva línea
    `Indigo:\n` +
    `1. ${weeklyPollData[dayName]["Indigo"]["1"]}\n` +
    `2. ${weeklyPollData[dayName]["Indigo"]["2"]}\n` +
    `3. ${weeklyPollData[dayName]["Indigo"]["3"]}\n\n` + // Solo 3 opciones
    `Elige el lugar:\nC: ComeSano\nI: Indigo\n\n` +
    `Responde con el número de la opción y la letra del lugar, separados por un espacio.\n` +
    `Ejemplo: "1 C"\n\n`+
    `Para Armar tu ensalada: "5 C"`; // Nueva línea
    
    // Lista de destinatarios (grupos o usuarios)
  const recipients = ['120363386274928136@g.us'];

  recipients.forEach(recipient => {
    client.sendMessage(recipient, pollText)
      .then(() => console.log(`Encuesta enviada a ${recipient} para ${dayName}`))
      .catch(err => console.error(`Error al enviar encuesta a ${recipient}:`, err));
  });
}

// Objeto para trackear el estado de los usuarios
let saladBuilders = {};

// Función para normalizar IDs a formato privado
function normalizeChatId(msg) {
  if (msg.from.endsWith('@g.us')) {
    return msg.author.replace(/:\d+@/, '@'); // Ej: 5493875028829@c.us
  }
  return msg.from; // Ya es un chat privado
}

// Evento para manejar mensajes
client.on('message', async msg => {
  try {
    const body = msg.body.trim().toUpperCase();
    const userChatId = normalizeChatId(msg);

    // Si está en proceso de armar ensalada
    if (saladBuilders[userChatId]) {
      await handleSaladCreation(msg, userChatId);
      return;
    }

    // Detectar selección de ensalada
    if (body === '5 C') {
      if (msg.from.endsWith('@g.us')) {
        try {
          // Solo notificar en el grupo y manejar el inicio en privado
          await msg.reply("🔔 Te estoy enviando las instrucciones por privado...");
          await startSaladCreation(userChatId); // Este envía el primer mensaje
        } catch (error) {
          await msg.reply("⚠️ ¡Necesitas iniciar un chat privado conmigo primero!");
          return;
        }
      } else {
        await startSaladCreation(userChatId);
      }
    }
    
  } catch (error) {
    console.error('Error procesando mensaje:', error);
  }
});

async function startSaladCreation(userChatId) {
  // Verificar si ya existe una sesión
  if (saladBuilders[userChatId]) return;

  saladBuilders[userChatId] = {
    step: saladSteps.INGREDIENTS,
    ingredients: [],
    complements: [],
    aderezos: [],
    toppings: []
  };
  
  // Enviar solo UN mensaje de inicio
  await client.sendMessage(userChatId, 
    "🥗 *Paso 1/4 - Ingredientes*:\n" +
    "Elegí hasta 4 (ejemplo: 1,3,5):\n" +
    saladOptions.ingredients.map((item, index) => `${index + 1}. ${item}`).join("\n")
  );
}

async function handleSaladCreation(msg, userChatId) {
  const currentState = saladBuilders[userChatId];
  const response = msg.body.trim();
  
  try {
    switch(currentState.step) {
      case saladSteps.INGREDIENTS:
        const ingredients = response.split(',')
          .map(num => parseInt(num.trim()) - 1)
          .filter(index => index >= 0 && index < saladOptions.ingredients.length)
          .slice(0, 4)
          .map(index => saladOptions.ingredients[index]);
        
        if(ingredients.length < 1) throw new Error("Selección inválida");
        
        currentState.ingredients = ingredients;
        currentState.step = saladSteps.COMPLEMENTS;
        
        await client.sendMessage(userChatId,
          "🍗 *Paso 2/4 - Complementos*:\n" +
          "Elegí hasta 2 (ejemplo: 2,7):\n" +
          saladOptions.complements.map((item, index) => `${index + 1}. ${item}`).join("\n")
        );
        break;
        
      case saladSteps.COMPLEMENTS:
        const complements = response.split(',')
          .map(num => parseInt(num.trim()) - 1)
          .filter(index => index >= 0 && index < saladOptions.complements.length)
          .slice(0, 2)
          .map(index => saladOptions.complements[index]);
        
        currentState.complements = complements;
        currentState.step = saladSteps.ADEREZOS;
        
        await client.sendMessage(userChatId,
          "🥄 *Paso 3/4 - Aderezos*:\n" +
          "Elegí 1 (ejemplo: 3):\n" +
          saladOptions.aderezos.map((item, index) => `${index + 1}. ${item}`).join("\n")
        );
        break;
        
      case saladSteps.ADEREZOS:
        const aderezoIndex = parseInt(response) - 1;
        if(isNaN(aderezoIndex) || aderezoIndex < 0 || aderezoIndex >= saladOptions.aderezos.length) {
          throw new Error("Selección inválida");
        }
        
        currentState.aderezos = [saladOptions.aderezos[aderezoIndex]];
        currentState.step = saladSteps.TOPPINGS;
        
        await client.sendMessage(userChatId,
          "✨ *Paso 4/4 - Toppings*:\n" +
          "Elegí 1 (ejemplo: 2):\n" +
          saladOptions.toppings.map((item, index) => `${index + 1}. ${item}`).join("\n")
        );
        break;
        
      case saladSteps.TOPPINGS:
        const toppingIndex = parseInt(response) - 1;
        if(isNaN(toppingIndex) || toppingIndex < 0 || toppingIndex >= saladOptions.toppings.length) {
          throw new Error("Selección inválida");
        }
        
        currentState.toppings = [saladOptions.toppings[toppingIndex]];
        
        // Guardar ensalada
        const dayName = dayNames[new Date().getDay()];
        if (!salads[dayName]) salads[dayName] = [];
        salads[dayName].push(currentState);
        fs.writeFileSync(SALAD_DATA_FILE, JSON.stringify(salads, null, 2));
        
        await client.sendMessage(userChatId,
          "✅ *¡Ensalada registrada!*\n" +
          "Gracias por tu pedido:\n" +
          `Ingredientes: ${currentState.ingredients.join(", ")}\n` +
          `Complementos: ${currentState.complements.join(", ")}\n` +
          `Aderezo: ${currentState.aderezos.join(", ")}\n` +
          `Topping: ${currentState.toppings.join(", ")}`
        );
        
        delete saladBuilders[userChatId];
        break;
    }
  } catch (error) {
    await client.sendMessage(userChatId, 
      "❌ *Error*: " + error.message + "\n\n" +
      "Por favor envía una opción válida:\n" +
      getCurrentStepInstructions(currentState.step) // Función que devuelve instrucciones según el paso
    );
  }
}

// Función auxiliar para mensajes de error
function getCurrentStepInstructions(step) {
  switch(step) {
    case saladSteps.INGREDIENTS:
      return saladOptions.ingredients.map((item, index) => `${index + 1}. ${item}`).join("\n");
    case saladSteps.COMPLEMENTS:
      return saladOptions.complements.map((item, index) => `${index + 1}. ${item}`).join("\n");
    case saladSteps.ADEREZOS:
      return saladOptions.aderezos.map((item, index) => `${index + 1}. ${item}`).join("\n");
    case saladSteps.TOPPINGS:
      return saladOptions.toppings.map((item, index) => `${index + 1}. ${item}`).join("\n");
  }
}


// Evento para capturar las respuestas y registrar votos
client.on('message', message => {
  const text = message.body.trim();
  const parts = text.split(/\s+/);
  if (parts.length === 2 && /^[1-4]$/.test(parts[0]) && /^[CIci]$/.test(parts[1])) {
    const now = new Date();
    const dayNumber = now.getDay();
    if (dayNumber < 1 || dayNumber > 5) {
      message.reply("La encuesta no está activa hoy.");
      return;
    }
    const dayName = dayNames[dayNumber];
    const option = parts[0];
    const place = parts[1].toUpperCase() === 'C' ? 'ComeSano' : 'Indigo';
    // Usar message.author si existe; si no, message.from
    const voterId = message.author ? message.author : message.from;
    
    // Elimina votos previos del usuario (para todas las opciones y lugares)
    Object.keys(votes[dayName]).forEach(opt => {
      Object.keys(votes[dayName][opt]).forEach(loc => {
        votes[dayName][opt][loc] = votes[dayName][opt][loc].filter(id => id !== voterId);
      });
    });
    // Registra el voto
    votes[dayName][option][place].push(voterId);
    saveVotes();

    client.sendMessage(voterId, `Tu voto para "${weeklyPollData[dayName][place][option]}" en ${place} ha sido registrado.`);
    console.log(`Votos para ${dayName}:`, votes[dayName]);
  }
});

client.initialize();
