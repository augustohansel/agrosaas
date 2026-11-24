import { useState, useEffect } from "react";
import { useFarmScope } from "../../contexts/FarmContext";
import { CloudSun, Thermometer, Wind, Droplets, CloudRain } from "lucide-react";

type Reading = {
  temp: number;
  humidity: number;
  wind: number;
  rain: number;
  time: number;
};
export function classify(w: Reading) {
  if (
    w.wind < 2 ||
    w.wind > 15 ||
    w.humidity < 45 ||
    w.temp > 32 ||
    w.rain >= 65
  )
    return "Restrito";
  if (
    w.wind < 3 ||
    w.wind > 10 ||
    w.humidity < 55 ||
    w.temp > 29 ||
    w.rain >= 35
  )
    return "Atenção";
  return "Ideal";
}
export function FarmWeather({ demo }: { demo: boolean }) {
  const { visible, all, selected } = useFarmScope();
  const [choice, choose] = useState("");
  const farm = selected ?? visible.find(f => f.id === choice) ?? visible.find(f => f.latitude != null && f.longitude != null) ?? visible[0];
  return <Weather key={farm?.id ?? "demo"} demo={demo} lat={farm?.latitude} lng={farm?.longitude}
    selector={!demo && all && farm && <label>Previsão para <select value={farm.id} onChange={e => choose(e.target.value)}>
      {visible.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
    </select></label>} />;
}
function Weather({
  lat,
  lng,
  demo,
  selector,
}: {
  lat?: number;
  lng?: number;
  demo: boolean;
  selector?: React.ReactNode;
}) {
  const [read, setRead] = useState<Reading | null>(null);
  const [error, setError] = useState(false);
  const [revision, retry] = useState(0);
  const [hour, setHour] = useState(0);
  useEffect(() => {
    setRead(null);
    setError(false);
    if (demo || lat == null || lng == null) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const params = new URLSearchParams({
          latitude: lat!.toFixed(2),
          longitude: lng!.toFixed(2),
          current: "temperature_2m,relative_humidity_2m,wind_speed_10m",
          hourly: "precipitation_probability",
          forecast_hours: "4",
          timeformat: "unixtime",
        });
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?" + params,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(15000),
            ]),
          },
        );
        if (!res.ok) throw Error();
        const { current: c, hourly: h } = await res.json();
        const rain = h.precipitation_probability.slice(1, 4);
        if (
          rain.length !== 3 ||
          ![
            c.temperature_2m,
            c.relative_humidity_2m,
            c.wind_speed_10m,
            c.time,
            ...rain,
          ].every(Number.isFinite)
        )
          throw Error();
        setRead({
          temp: c.temperature_2m,
          humidity: c.relative_humidity_2m,
          wind: c.wind_speed_10m,
          rain: Math.max(...rain),
          time: c.time * 1000,
        });
        setError(false);
      } catch {
        if (!controller.signal.aborted) {
          setRead(null);
          setError(true);
        }
      }
    }
    void refresh();
    const timer = setInterval(refresh, 15 * 60000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [lat, lng, demo, revision]);
  const reading = demo
    ? [
        { temp: 25, humidity: 68, wind: 7, rain: 12, time: 0 },
        { temp: 29, humidity: 54, wind: 11, rain: 34, time: 0 },
        { temp: 31, humidity: 49, wind: 16, rain: 72, time: 0 },
      ][hour]
    : read;
  const status = reading ? classify(reading) : "Sem leitura";
  return (
    <section className="weather panel">
      <header>
        <CloudSun />
        <h2>Janela de pulverização</h2>
      </header>
      {selector}
      <div
        className={
          "weather-state state-" +
          (status === "Ideal" ? "good" : status === "Restrito" ? "bad" : "warn")
        }
      >
        <i />
        {status}
      </div>
      {reading ? (
        <>
          <div className="weather-grid">
            {[
              [Wind, "Vento", reading.wind + " km/h"],
              [Droplets, "Umidade", reading.humidity + "%"],
              [Thermometer, "Temperatura", reading.temp + " °C"],
              [CloudRain, "Chuva em 3 h", reading.rain + "%"],
            ].map(([Icon, label, value]) => {
              const Symbol = Icon as typeof Wind;
              return (
                <div key={String(label)}>
                  <Symbol size={16} />
                  <small>{String(label)}</small>
                  <strong>{String(value)}</strong>
                </div>
              );
            })}
          </div>
          {demo ? (
            <div className="segmented">
              {["Agora", "+1 hora", "+2 horas"].map((h, i) => (
                <button
                  key={h}
                  aria-pressed={i === hour}
                  onClick={() => setHour(i)}
                >
                  {h}
                </button>
              ))}
            </div>
          ) : (
            <small>
              Open-Meteo ·{" "}
              {new Date(reading.time).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          )}
          <small>
            {demo ? "Cenário simulado. " : ""}Triagem climática. Confirme as
            condições locais e a bula.
          </small>
        </>
      ) : (
        <p>
          {error
            ? "Previsão indisponível."
            : lat == null || lng == null
              ? "Selecione uma fazenda com posição definida no mapa."
              : "Consultando previsão…"}{" "}
          {error && (
            <button onClick={() => retry((v) => v + 1)}>
              Tentar novamente
            </button>
          )}
        </p>
      )}
    </section>
  );
}
