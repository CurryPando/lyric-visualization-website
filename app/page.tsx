'use client';
import React, { useState } from 'react';

export default function Predictor() {
  const [inputText, setInputText] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    setError(null);
    setPrediction(null);

    try {
      // Hit our secure Vercel internal API endpoint instead of Modal directly
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(data.error || 'Something went wrong running inference.');
        throw new Error(data.error || 'Something went wrong running inference.');
      }

      // Set your result state (adjust 'data.prediction' depending on your exact Modal output schema)
      setPrediction(data);
    } catch (err: any) {
      console.error(err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h2>BERT Project Interface</h2>
      <p style={{ color: '#666' }}>Enter your text below to get an instant model prediction.</p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <textarea
          rows={5}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste or type text for BERT to analyze..."
          disabled={loading}
          style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
        />
        
        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          style={{
            padding: '12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: loading ? '#ccc' : '#0070f3',
            color: 'white',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          {loading ? 'Running Inference...' : 'Analyze Text'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {prediction && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
          <h3 style={{ marginTop: 0 }}>Model Output:</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
            {JSON.stringify(prediction, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}