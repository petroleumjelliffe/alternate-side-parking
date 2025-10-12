import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import ParkingGame from './ParkingGame'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div>
    <h1>hello world</h1>
    <ParkingGame />
    </div>
  )
}

export default App
