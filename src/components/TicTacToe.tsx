import { useState } from "react";
import { X, RotateCcw } from "lucide-react";

interface TicTacToeProps {
  open: boolean;
  onClose: () => void;
  onSendResult: (result: string) => void;
}

export function TicTacToe({ open, onClose, onSendResult }: TicTacToeProps) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isX, setIsX] = useState(true);

  if (!open) return null;

  const winner = checkWinner(board);
  const isDraw = !winner && board.every((c) => c !== null);

  const handleClick = (i: number) => {
    if (board[i] || winner) return;
    const next = [...board];
    next[i] = isX ? "X" : "O";
    setBoard(next);
    setIsX(!isX);
  };

  const reset = () => { setBoard(Array(9).fill(null)); setIsX(true); };

  const shareResult = () => {
    const result = winner ? `🎮 Tic-Tac-Toe: ${winner} wins!` : isDraw ? "🎮 Tic-Tac-Toe: Draw!" : "🎮 Tic-Tac-Toe: Game in progress";
    onSendResult(result);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-xs rounded-3xl glass-strong border border-border/60 shadow-elegant p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif italic gradient-text">Tic-Tac-Toe</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {board.map((cell, i) => (
            <button
              key={i}
              onClick={() => handleClick(i)}
              className={`flex h-16 items-center justify-center rounded-xl text-2xl font-bold transition-all ${
                cell ? "bg-secondary" : "bg-secondary/50 hover:bg-surface-hover"
              } ${cell === "X" ? "text-primary" : "text-accent"}`}
            >
              {cell}
            </button>
          ))}
        </div>

        <div className="text-center mb-3">
          {winner ? (
            <p className="text-sm font-semibold gradient-text">{winner} wins! 🎉</p>
          ) : isDraw ? (
            <p className="text-sm text-muted-foreground">Draw!</p>
          ) : (
            <p className="text-xs text-muted-foreground">Turn: <span className={isX ? "text-primary" : "text-accent"}>{isX ? "X" : "O"}</span></p>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={reset} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs bg-secondary hover:bg-surface-hover">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          {(winner || isDraw) && (
            <button onClick={shareResult} className="flex-1 rounded-xl py-2 text-xs gradient-primary text-primary-foreground shadow-glow">
              Share Result
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function checkWinner(board: (string | null)[]): string | null {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}
