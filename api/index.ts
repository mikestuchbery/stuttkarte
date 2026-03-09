import express from "express";

const app = express();

// Proxy for VVS EFA API to avoid CORS issues
app.get("/api/vvs/stops", async (req, res) => {
  const query = req.query.name as string;
  if (!query) {
    return res.status(400).json({ error: "Missing name parameter" });
  }

  try {
    const url = `https://efa.vvs.de/vvs/XML_STOPFINDER_REQUEST?outputFormat=JSON&type_sf=any&anyObjFilter_sf=2&itdExtractTariff=1&name_sf=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Failed to fetch from VVS API" });
  }
});

// Proxy for VVS Coordinate Search (Nearest Stop)
app.get("/api/vvs/nearest", async (req, res) => {
  const lat = req.query.lat as string;
  const lon = req.query.lon as string;
  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat or lon parameters" });
  }

  try {
    const url = `https://efa.vvs.de/vvs/XSLT_COORD_REQUEST?outputFormat=JSON&coordOutputFormat=WGS84[DD.ddddd]&type_1=STOP&name_1=${lon}:${lat}:WGS84&radius_1=1000&max_1=5&itdExtractTariff=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Failed to fetch from VVS API" });
  }
});

export default app;
