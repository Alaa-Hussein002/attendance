import { ReactNode } from 'react';
import { Lockup, Mark } from './Logo';

/** Split screen from the identity: the interlocked mark as a cropped black mass, the slogan, the form on paper. */
export default function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <div className="art">
        <Lockup invert height={60} />
        <Mark invert size={640} style={{ position: 'absolute', insetInlineEnd: '-16%', bottom: '-14%', height: 'auto', width: '82%' }} />
        <div className="claim"><h2>Make room<br />to create</h2><div className="rule" /><div className="en" style={{ opacity: .6 }}>Learn · Make · Produce</div></div>
      </div>
      <div className="form"><div className="box">{children}</div></div>
    </div>
  );
}
