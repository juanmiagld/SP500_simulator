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
    const header = ['month', ...sims.map((_,i)=>`Sim_${i+1}`)].join(',');
    const rows = Array.from({ length: months }, (_,m) =>
      [m+1, ...sims.map(path => path[m].toFixed(2))].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const
