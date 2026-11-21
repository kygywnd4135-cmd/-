import sys, os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from lib import *
from lib import _yy,_xx
import opening as OP
from crest_fx import load_crest,draw_crest
CREST=load_crest(S+'cut/crest.png')
from PIL import Image, ImageDraw, ImageFont
import subprocess, multiprocessing as mp
from scipy import ndimage as nd
K=2; GOLD=np.array([0.88,0.72,0.42],np.float32); ICE=np.array([0.70,0.84,1.0],np.float32)
DUR=12.0; N=int(DUR*FPS)

# ---------- symbol ----------
sym=np.asarray(Image.open(S+'figma/symbol_3x.png')).astype(np.float32)/255
sym_a=sym[...,3]; SYH,SYW=sym_a.shape
lab,nl=nd.label(sym_a>0.35)
lab=nd.grey_dilation(lab,size=(5,5))*(sym_a>0)   # give AA edges a component id
cen=nd.center_of_mass(np.ones_like(sym_a),lab,range(1,nl+1))
cxs,cys=SYW/2,SYH*0.47
dists=np.array([math.hypot(c[1]-cxs,c[0]-cys) for c in cen]); dn=dists/dists.max()
def sym_layer(t_rel, sweep=None):
    """premultiplied RGBA of symbol; pieces appear from centre outward over ~1.3s"""
    st=np.concatenate([[9e9],0.15+dn*1.1])           # start time per component
    prog=np.clip((t_rel-st)/0.45,0,1); prog=prog*prog*(3-2*prog)
    a=sym_a*prog[lab]
    rgb=np.ones((SYH,SYW,3),np.float32)*np.array([0.93,0.96,1.0])
    if sweep is not None:
        yy,xx=np.mgrid[0:SYH,0:SYW]
        band=np.exp(-(((xx*0.55+yy*0.85)/SYH-sweep)/0.05)**2).astype(np.float32)
        rgb=rgb+band[...,None]*np.array([0.6,0.5,0.25])
    return np.dstack([rgb*a[...,None],a]).astype(np.float32)

# ---------- text layer (frame-size, premultiplied) ----------
def font(path,size,var=None):
    f=ImageFont.truetype(path,size)
    if var:
        try: f.set_variation_by_name(var)
        except Exception: pass
    return f
F_EN=font(S+'fonts/Cinzel.ttf',128,'Bold'); F_KR=font(S+'fonts/suite/SUITE-Medium.ttf',44); F_EP=font(S+'fonts/suite/SUITE-SemiBold.ttf',30)
def band_at(m,cy):
    b=np.zeros((FH,FW),np.float32); y0=cy-200; y1=min(FH,y0+400); b[y0:y1]=m[:y1-y0]; return b
def text_mask(txt,f,spacing):
    widths=[f.getbbox(c)[2]-f.getbbox(c)[0] for c in txt]
    total=sum(widths)+spacing*(len(txt)-1)
    m=Image.new('L',(FW,400),0); d=ImageDraw.Draw(m); x=(FW-total)/2
    boxes=[]
    for c,w in zip(txt,widths):
        b=f.getbbox(c); d.text((x-b[0],200-(b[1]+b[3])/2),c,font=f,fill=255); boxes.append((x,w)); x+=w+spacing
    return np.asarray(m).astype(np.float32)/255
def text_mask_plain(txt,f):
    """whole-string draw with the font's own advances/kerning (letter-spacing 0)"""
    m=Image.new('L',(FW,400),0); d=ImageDraw.Draw(m)
    d.text((FW/2,200),txt,font=f,fill=255,anchor='mm')
    return np.asarray(m).astype(np.float32)/255
def gold_fill(m):
    h=m.shape[0]; g=np.linspace(0,1,h)[:,None]
    c1=np.array([1.0,0.93,0.72]); c2=np.array([0.80,0.60,0.30]); c3=np.array([0.98,0.85,0.55])
    grad=np.where(g[...,None]<0.55,c1+(c2-c1)*(g[...,None]/0.55),c2+(c3-c2)*((g[...,None]-0.55)/0.45))
    return grad*m[...,None]

# ---------- ornamental frame ----------
def draw_frame(t_rel):
    lay=np.zeros((FH,FW,3),np.float32); p=eout(t_rel/1.1,3)
    if p<=0: return lay
    col=tuple(float(c) for c in GOLD)
    for inset,th in ((40,2),(54,1)):
        x0,y0,x1,y1=inset,inset,FW-inset,FH-inset
        # each side grows from both corners toward its middle
        for (ax,ay,bx,by) in ((x0,y0,x1,y0),(x1,y0,x1,y1),(x1,y1,x0,y1),(x0,y1,x0,y0)):
            mx,my=(ax+bx)/2,(ay+by)/2
            for (sx_,sy_) in ((ax,ay),(bx,by)):
                ex,ey=sx_+(mx-sx_)*p,sy_+(my-sy_)*p
                cv2.line(lay,(int(sx_),int(sy_)),(int(ex),int(ey)),col,th,cv2.LINE_AA)
    # corner diamonds + brackets
    k=eout((t_rel-0.5)/0.6)
    if k>0:
        for (x,y,sx_,sy_) in ((40,40,1,1),(FW-40,40,-1,1),(40,FH-40,1,-1),(FW-40,FH-40,-1,-1)):
            d=14*k; pts=np.array([(x,y-d),(x+d,y),(x,y+d),(x-d,y)],np.int32)
            cv2.fillPoly(lay,[pts],col,cv2.LINE_AA)
            L=int(70*k); o=26
            cv2.line(lay,(x+sx_*o,y+sy_*o),(x+sx_*(o+L),y+sy_*o),col,1,cv2.LINE_AA)
            cv2.line(lay,(x+sx_*o,y+sy_*o),(x+sx_*o,y+sy_*(o+L)),col,1,cv2.LINE_AA)
        # mid-side ticks
        for (x,y) in ((FW//2,40),(FW//2,FH-40)):
            d=9*k; cv2.fillPoly(lay,[np.array([(x,y-d),(x+d,y),(x,y+d),(x-d,y)],np.int32)],col,cv2.LINE_AA)
    return lay

# ---------- light rays ----------
_ang=np.arctan2(_yy-FH*0.30,_xx-FW/2); _rad=np.hypot(_xx-FW/2,_yy-FH*0.30)
def rays(t,k):
    r=(0.5+0.5*np.sin(_ang*13+t*0.35))**6+(0.5+0.5*np.sin(_ang*7-t*0.22+1))**8*0.7
    fall=np.exp(-_rad/700)
    return (r*fall)[...,None]*ICE*k

def flash(t,tb,w=0.08,k=1.0): return k*math.exp(-((t-tb)/w)**2)

def affine(cx,cy,scale,rot,sx,sy):
    M=cv2.getRotationMatrix2D((sx,sy),rot,scale); M[0,2]+=cx-sx; M[1,2]+=cy-sy; return M
def xf(M,x,y): return M[0,0]*x+M[0,1]*y+M[0,2], M[1,0]*x+M[1,1]*y+M[1,2]
def place_M(layer,M): return cv2.warpAffine(layer,M,(FW,FH),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)

T1,T2,T3,T4,T5=3.2,3.9,5.4,6.9,8.4   # shot boundaries

def shot_char(t):
    """returns (M, extra_layer) for the character shots"""
    if t<T3:   # coat hem -> garter
        u=(t-T2)/(T3-T2); e=eio(u)
        fx,fy=840+(700-840)*e,1400+(900-1400)*e
        sc=1.36-0.06*e+0.06*(1-eout(u*4)); rot=-6+4*e
    elif t<T4: # sword hilt, slide along blade
        u=(t-T3)/(T4-T3); e=eio(u)
        fx,fy=400-60*e,800+110*e
        sc=1.50-0.08*e+0.06*(1-eout(u*4)); rot=9-4*e
    elif t<T5: # face
        u=(t-T4)/(T5-T4); e=eio(u)
        fx,fy=622,200+28*e
        sc=1.62-0.24*e+0.05*(1-eout(u*4)); rot=-2+2*e
    else:      # reveal
        u=(t-T5)/(DUR-T5-0.6); e=eout(u,3)
        fx,fy=616,330+(816-330)*e
        sc=1.05+(0.68-1.05)*e; rot=0
    cy=(FH*0.45 if T4<=t<T5 else FH*0.5) if t<T5 else FH*0.5+(1359-FH*0.5)*e
    return affine(FW/2,cy,sc,rot,fx*K,fy*K)

def render(f):
    t=f/FPS; img=bg_navy(t)
    if t<T2:
        return to8(OP.opening(t,T1,T2))
    # ---------------- character shots ----------------
    amp=1.0 if t<T5 else 1.0
    ch=char_frame(t,amp)
    M=shot_char(t)
    if t>=T5:
        e=eout((t-T5)/(DUR-T5-0.6),3)
        # big faint symbol behind character
        bf=np.zeros((FH,FW),np.float32); bl=np.zeros((FH,FW),np.float32)
        cam=(FW/2,FH*0.36,620+40*(t-T5)/3.6,math.radians(4*(t-T5)))
        OP.draw_flake(cam,1.15,0,bf,bl); Lf=OP.shade_flake(bf,bl,cam,1.0)
        add(img,cv2.GaussianBlur(Lf,(0,0),16),0.25*e); add(img,Lf,0.16*e)
    add(img,particles(t,0.6,(0,-60*t)))
    L=place_M(ch,M)
    add(img,glow(L,22,0.16)); over(img,L)
    fg=np.zeros((FH,FW,3),np.float32)
    # glints
    if T3<=t<T4:   # glint travelling along blade
        u=clamp((t-T3-0.35)/0.9)
        if 0<u<1:
            bx,by=455+(60-455)*u,830+(1470-830)*u
            x,y=xf(M,bx*K,by*K); sparkle(fg,x,y,70,1.0*math.sin(math.pi*u),(1,0.97,0.9),rot=30)
        for (gx,gy,ph) in ((392,848,0.0),(345,888,0.5)):
            k=max(0,math.sin((t-T3)*3.1+ph*6))**6
            x,y=xf(M,gx*K,gy*K); sparkle(fg,x,y,40,0.9*k,(0.7,0.85,1.0),rot=15)
    elif T2<=t<T3:
        for (gx,gy,ph) in ((930,1320,0.0),(690,880,0.7),(700,1585,0.3)):
            k=max(0,math.sin((t-T2)*3.4+ph*6))**6
            x,y=xf(M,gx*K,gy*K); sparkle(fg,x,y,46,0.9*k,(1,0.88,0.6))
    elif T4<=t<T5:
        for (gx,gy,ph) in ((585,238,0.0),(706,230,0.55),(618,120,0.25)):
            k=max(0,math.sin((t-T4)*2.8+ph*6))**6
            x,y=xf(M,gx*K,gy*K); sparkle(fg,x,y,44,0.85*k,(0.75,0.88,1.0),rot=10)
    add(img,fg+cv2.GaussianBlur(fg,(0,0),7)*1.4)
    if t>=T5:
        tr=t-T5
        add(img,draw_frame(tr-0.5)*1.0); add(img,cv2.GaussianBlur(draw_frame(tr-0.5),(0,0),4),0.8)
        # bottom dark gradient for title legibility
        g=np.clip((_yy-FH*0.70)/(FH*0.30),0,1)[...,None]**1.4
        img[...,:3]*=1-0.72*g*eout(tr/1.2)
        # top emblem: Nea's crest
        draw_crest(img,CREST,tr,(0.95,0.75,0.40),size=230,cy=165)
        # title
        kt=eout((tr-1.3)/1.1,3)
        if kt>0:
            sp=int(150-110*kt)
            m=text_mask('NEA',F_EN,int(sp*0.7)); y0=1395
            band=band_at(m,y0+200)
            col=gold_fill(band)
            add(img,cv2.GaussianBlur(col,(0,0),14),0.9*kt)
            over(img,np.dstack([col*kt,band*kt]))
            # sheen sweep across title
            su=(tr-2.5)/0.8
            if 0<su<1:
                sh=np.exp(-((_xx-(-200+su*1480)+(_yy-y0)*0.4)/60)**2)*band
                add(img,sh[...,None]*np.array([1,1,0.9]),0.8)
        kk=eout((tr-1.9)/0.9)
        if kk>0:
            # divider with diamond
            dv=np.zeros((FH,FW,3),np.float32); y=1686; w=int(260*kk)
            cv2.line(dv,(FW//2-w,y),(FW//2-26,y),tuple(float(c) for c in GOLD),1,cv2.LINE_AA)
            cv2.line(dv,(FW//2+26,y),(FW//2+w,y),tuple(float(c) for c in GOLD),1,cv2.LINE_AA)
            cv2.fillPoly(dv,[np.array([(FW//2,y-9),(FW//2+9,y),(FW//2,y+9),(FW//2-9,y)],np.int32)],tuple(float(c) for c in GOLD),cv2.LINE_AA)
            add(img,dv+cv2.GaussianBlur(dv,(0,0),4))
            b1=band_at(text_mask_plain('에피소드 2',F_EP),1736)
            over(img,np.dstack([gold_fill(b1)*kk,b1*kk]))
            k2=eout((tr-2.2)/0.9)
            if k2>0:
                b2=band_at(text_mask_plain('아침이 오지 않는 설국',F_KR),1800)
                add(img,cv2.GaussianBlur(b2,(0,0),8)[...,None]*np.array([0.5,0.65,1.0]),0.5*k2)
                over(img,np.dstack([np.ones((FH,FW,3))*np.array([0.94,0.96,1.0])*(b2*k2)[...,None],b2*k2]))
    # shot-cut flashes
    fl=flash(t,T2,0.12,1.2)+flash(t,T3,0.07,0.9)+flash(t,T4,0.07,0.9)+flash(t,T5,0.09,1.0)
    img[...,:3]+=fl*np.array([0.85,0.92,1.0])
    # fade-in from flash for each cut
    return to8(img)

if __name__=='__main__':
    only=sys.argv[1:]  # optional frame list for previews
    if only:
        for f in map(int,only): Image.fromarray(render(f)).save(S+f'output/pv_{f:03d}.png')
        sys.exit()
    out=S+'output/nea_motion.mp4'
    p=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{FW}x{FH}','-r',str(FPS),'-i','-',
        '-c:v','libx264','-pix_fmt','yuv420p','-crf','16','-preset','slow','-movflags','+faststart',out],stdin=subprocess.PIPE)
    with mp.get_context('fork').Pool(3) as pool:
        for i,fr in enumerate(pool.imap(render,range(N),chunksize=2)):
            p.stdin.write(fr.tobytes())
            if i%30==0: print(i,flush=True)
    p.stdin.close(); p.wait(); print('done',out)
