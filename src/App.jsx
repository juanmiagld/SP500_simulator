
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Line, BarChart, Bar, CartesianGrid
} from 'recharts';

function runMonteCarlo(params) {
  const { nSimulations, years, initialInvestment, monthlyContribution, inflationRate, annualReturn, volatility } = params;
  const months = years * 12;
  const mean = Math.pow(1 + annualReturn, 1/12) - 1;
  const stdDev = volatility / Math.sqrt(12);

  // Generar simulaciones
  const sims = Array.from({ length: nSimulations }, () => {
    let value = initialInvestment, contrib = monthlyContribution;
    const path = [];
    for (let m = 1; m <= months; m++) {
      if (m % 12 === 1 && m > 1) contrib *= 1 + inflationRate;
      const r = mean + stdDev * randNormal();
      value = value * (1 + r) + contrib;
      path.push(value);
    }
    return path;
  });

  // Calcular percentiles mes a mes
  const data = [];
  for (let m = 0; m < months; m++) {
    const values = sims.map(path => path[m]).sort((a,b)=>a-b);
    data.push({
      month: m + 1,
      p10: percentile(values, 0.1),
      p50: percentile(values, 0.5),
      p90: percentile(values, 0.9)
    });
  }
  return { data, sims };
}

// Generador normal estándar (Box-Muller)
function randNormal() {
  let u=0, v=0;
  while(u===0) u = Math.random();
  while(v===0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Percentil simple
function percentile(arr, p) {
  const idx = (arr.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
}

export default function App() {
  const [params, setParams] = useState({
    nSimulations: 100,
    years: 20,
    initialInvestment: 100000,
    monthlyContribution: 700,
    inflationRate: 0.02,
    annualReturn: 0.075,
    volatility: 0.15,
  });
  const [mcResult, setMcResult] = useState({ data: [], sims: [] });

  const handleChange = e => {
    const { name, value } = e.target;
    setParams(ps => ({ ...ps, [name]: parseFloat(value) }));
  };

  const runSim = () => {
    setMcResult(runMonteCarlo(params));
  };

  const downloadCSV = () => {
    const { sims } = mcResult;
    if (!sims.length) return;
    const months = sims[0].length;
    const header = ['month', ...sims.map((_,i)=>\`Sim_\${i+1}\`)].join(',');
    const rows = Array.from({ length: months }, (_,m) =>
      [m+1, ...sims.map(path => path[m].toFixed(2))].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.setAttribute('download', 'montecarlo.csv');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const { data, sims } = mcResult;
  const finalVals = sims.map(path => path[path.length-1] || params.initialInvestment);
  const avgFinal = (finalVals.reduce((a,b)=>a+b,0) / finalVals.length).toFixed(0);
  const sorted = [...finalVals].sort((a,b)=>a-b);
  const finalP10 = percentile(sorted, 0.1).toFixed(0);
  const finalP90 = percentile(sorted, 0.9).toFixed(0);

  // Datos para retornos anuales
  const annualData = [];
  for (let y = 1; y <= params.years; y++) {
    const idxStart = (y-1)*12;
    const idxEnd = y*12 - 1;
    const startMed = data[idxStart]?.p50 || params.initialInvestment;
    const endMed = data[idxEnd]?.p50 || startMed;
    annualData.push({ year: y, return: ((endMed/startMed)-1)*100 });
  }

  // Histograma final
  const histData = [];
  if (finalVals.length) {
    const min = Math.min(...finalVals), max = Math.max(...finalVals);
    const bins = 20, size = (max-min)/bins;
    const counts = Array(bins).fill(0);
    finalVals.forEach(v => {
      const idx = Math.min(Math.floor((v-min)/size), bins-1);
      counts[idx]++;
    });
    for (let i=0;i<bins;i++){
      histData.push({
        bin: `${Math.round(min + i*size)}-\${Math.round(min + (i+1)*size)}`,
        count: counts[i]
      });
    }
  }

  return (
    <div className="container">
      <h1>S&P 500 Monte Carlo Simulator</h1>
      <div className="grid">
        {Object.entries({
          nSimulations: '# Sim',
          years: 'Years',
          initialInvestment: 'Initial €',
          monthlyContribution: 'Monthly €',
          inflationRate: 'Inflation',
          annualReturn: 'Annual Return',
          volatility: 'Volatility'
        }).map(([key,label])=>(
          <div key={key}>
            <label>{label}</label>
            <input name={key} type="number" step="any"
              value={params[key]} onChange={handleChange}/>
          </div>
        ))}
      </div>
      <button onClick={runSim}>Run Simulation</button>
      {data.length>0 && (
        <>
          <div className="metrics">
            <strong>Avg Final:</strong> €{avgFinal}
            {' '}<strong>P10:</strong> €{finalP10}
            {' '}<strong>P90:</strong> €{finalP90}
            {' '}<button onClick={downloadCSV}>Download CSV</button>
          </div>

          <div className="chart-section">
            <h2>Banda de Confianza (P10–P90) y Mediana</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data}>
                <XAxis dataKey="month"/>
                <YAxis/>
                <Tooltip formatter={val=>new Intl.NumberFormat().format(Math.round(val))}/>
                <Area type="monotone" dataKey="p90" stroke="none" fill="lightblue" baseValue={0} fillOpacity={0.3}/>
                <Area type="monotone" dataKey="p10" stroke="none" fill="#fff" baseValue="dataMax" fillOpacity={1}/>
                <Line type="monotone" dataKey="p50" stroke="#0000ff" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-section">
            <h2>Retornos Anuales Medianos (%)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={annualData}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="year"/>
                <YAxis/>
                <Tooltip formatter={val=>val.toFixed(2) + '%'} />
                <Bar dataKey="return" fill="#82ca9d"/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-section">
            <h2>Histograma de Resultados Finales</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={histData}>
                <XAxis dataKey="bin" angle={-45} textAnchor="end" height={60}/>
                <YAxis/>
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
