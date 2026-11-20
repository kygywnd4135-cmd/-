import sys, os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from lib import *
from lib import _yy,_xx
import opening as OP
from opening import Canvas,LineLayer,Cam,Cluster,floret,leaf,star4,magic_circle,ob,BLUES,TEAL,TEAL_L,TEAL_D,PALE
from PIL import Image, ImageDraw, ImageFont
import subprocess, multiprocessing as mp
K=2; DUR=12.0; N=int(DUR*FPS)
FRAME_C=np.array([0.62,0.92,0.90],np.float32)
T1,T2,T3,T4,T5=3.2,3.9,5.4,6.9,8.4

# ---------- text ----------
def font(path,size,var=None):
    f=ImageFont.truetype(path,size)
    if var:
        try: f.set_variation_by_name(var)
        except Exception: pass
    return f
F_EN=font(S+'fonts/Cinzel.ttf',124,'Bold'); F_KR=font(S+'fonts/suite/SUITE-Medium.ttf',44); F_EP=font(S+'fonts/suite/SUITE-SemiBold.ttf',30)
def text_mask(txt,f,spacing):
    widths=[f.getbbox(c)[2]-f.getbbox(c)[0] for c in txt]; total=sum(widths)+spacing*(len(txt)-1)
    m=Image.new('L',(FW,400),0); d=ImageDraw.Draw(m); x=(FW-total)/2
    for c,w in zip(txt,widths):
        b=f.getbbox(c); d.text((x-b[0],200-(b[1]+b[3])/2),c,font=f,fill=255); x+=w+spacing
    return np.asarray(m).astype(np.float32)/255
def text_plain(txt,f):
    m=Image.new('L',(FW,400),0); ImageDraw.Draw(m).text((FW/2,200),txt,font=f,fill=255,anchor='mm')
    return np.asarray(m).astype(np.float32)/255
def band_at(m,cy):
    b=np.zeros((FH,FW),np.float32); y0=cy-200; y1=min(FH,y0+400); b[y0:y1]=m[:y1-y0]; return b
def grad_fill(m,c1,c2,c3):
    nz=np.where(m.max(1)>0)[0]
    if len(nz)==0: return np.zeros(m.shape+(3,),np.float32)
    y0,y1=nz[0],nz[-1]+1; g=np.clip((np.arange(m.shape[0])-y0)/max(1,y1-y0),0,1)[:,None,None]
    c1,c2,c3=[np.array(c,np.float32) for c in (c1,c2,c3)]
    col=np.where(g<0.55,c1+(c2-c1)*(g/0.55),c2+(c3-c2)*((g-0.55)/0.45))
    return col*m[...,None]

# ---------- ornamental frame (AA) ----------
def frame_layer(t_rel):
    ll=LineLayer(); p=eout(t_rel/1.1,3)
    if p<=0: return ll.f()
    for inset,th in ((40,2),(54,1)):
        x0,y0,x1,y1=inset,inset,FW-inset,FH-inset
        for (ax,ay,bx,by) in ((x0,y0,x1,y0),(x1,y0,x1,y1),(x1,y1,x0,y1),(x0,y1,x0,y0)):
            mx,my=(ax+bx)/2,(ay+by)/2
            for (sx_,sy_) in ((ax,ay),(bx,by)):
                ll.line((sx_,sy_),(sx_+(mx-sx_)*p,sy_+(my-sy_)*p),th)
    k=eout((t_rel-0.5)/0.6)
    if k>0:
        for (x,y,sx_,sy_) in ((40,40,1,1),(FW-40,40,-1,1),(40,FH-40,1,-1),(FW-40,FH-40,-1,-1)):
            d=14*k; ll.fill([(x,y-d),(x+d,y),(x,y+d),(x-d,y)])
            L=70*k; o=26
            ll.line((x+sx_*o,y+sy_*o),(x+sx_*(o+L),y+sy_*o)); ll.line((x+sx_*o,y+sy_*o),(x+sx_*o,y+sy_*(o+L)))
            # little floret ornament at corner bracket end
            ll.arc((x+sx_*(o+L+8),y+sy_*o),4*k,0,360); ll.arc((x+sx_*o,y+sy_*(o+L+8)),4*k,0,360)
        for (x,y) in ((FW//2,FH-40),):
            d=9*k; ll.fill([(x,y-d),(x+d,y),(x,y+d),(x-d,y)])
    return ll.f()

def flash(t,tb,w=0.08,k=1.0): return k*math.exp(-((t-tb)/w)**2)
def affine(cx,cy,scale,rot,sx,sy):
    M=cv2.getRotationMatrix2D((sx,sy),rot,scale); M[0,2]+=cx-sx; M[1,2]+=cy-sy; return M
def xf(M,x,y): return M[0,0]*x+M[0,1]*y+M[0,2], M[1,0]*x+M[1,1]*y+M[1,2]
def place_M(layer,M): return cv2.warpAffine(layer,M,(FW,FH),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)

def shot_char(t):
    bob=14*math.sin(2*math.pi*0.32*t); wob=0.8*math.sin(2*math.pi*0.21*t)
    if t<T3:   # shoes & legs -> skirt
        u=(t-T2)/(T3-T2); e=eio(u)
        fx,fy=650+(560-650)*e,1450+(1000-1450)*e
        sc=1.30-0.06*e+0.06*(1-eout(u*4)); rot=-6+4*e; cy=FH*0.5
    elif t<T4: # hat brim constellation + raised hand
        u=(t-T3)/(T4-T3); e=eio(u)
        fx,fy=760+100*e,330+80*e
        sc=1.34-0.08*e+0.06*(1-eout(u*4)); rot=-8+5*e; cy=FH*0.5
    elif t<T5: # face
        u=(t-T4)/(T5-T4); e=eio(u)
        fx,fy=632,430+22*e
        sc=1.62-0.22*e+0.05*(1-eout(u*4)); rot=-2+2*e; cy=FH*0.45
    else:      # reveal
        u=(t-T5)/(DUR-T5-0.6); e=eout(u,3)
        fx,fy=632+(616-632)*e,420+(816-420)*e
        sc=1.05+(0.60-1.05)*e; rot=0; cy=FH*0.5+(1208-FH*0.5)*e
    return affine(FW/2,cy+bob,sc,rot+wob,fx*K,fy*K)

# final-scene flora (screen coordinates)
SCR=Cam(0,0,1,0)
FIN_CL=[Cluster(20,1250,240,60,0.0,11),Cluster(1070,1080,215,54,0.0,12),Cluster(40,610,140,30,0.0,13),Cluster(1050,520,128,28,0.0,14)]
FIN_LV=[(-20,1180,300,80,math.radians(-30),0.15,0.0),(40,1220,260,70,math.radians(40),-0.15,0.05),
        (1110,1000,280,76,math.radians(210),-0.15,0.05),(1060,1060,240,64,math.radians(140),0.15,0.1),
        (70,560,190,52,math.radians(-20),0.15,0.1),(1040,470,180,50,math.radians(200),-0.15,0.15)]
rng=np.random.default_rng(31)
FALL=[dict(x=rng.uniform(0,FW),y=rng.uniform(-200,FH),v=rng.uniform(40,110),s=rng.uniform(8,20),c=BLUES[rng.integers(len(BLUES))],
           ph=rng.uniform(0,6.3),sp=rng.uniform(-2,2),fg=rng.random()<0.18) for _ in range(46)]
GLINT=[]
def glints(t,M,pts,col,cv):
    for (gx,gy,ph) in pts:
        k=max(0,math.sin(t*3.0+ph*6))**6
        if k>0.03:
            x,y=xf(M,gx*K,gy*K); star4(cv,np.array([x,y]),38*(0.5+0.5*k),tuple(c*k for c in col))

def render(f):
    t=f/FPS
    if t<T2: return to8(OP.opening(t,T1,T2))
    img=OP.background(FW/2,FH*0.45,t)
    ch=char_frame(t)
    M=shot_char(t)
    fin=t>=T5
    if fin:
        tr=t-T5; e=eout(tr/(DUR-T5-0.6),3)
        ll=LineLayer(); magic_circle(ll,Cam(FW/2,FH*0.40,1.0,0.06*tr),470,1.0,0.05*tr,-0.12*tr)
        m=ll.f(); k=0.35*eout(tr/1.0)
        img+=cv2.GaussianBlur(m,(0,0),7)[...,None]*np.array(TEAL,np.float32)*1.2*k+m[...,None]*np.array(PALE,np.float32)*0.45*k
        fl=Canvas()
        for (x,y,L,W,a,b,t0) in FIN_LV: leaf(fl,SCR,x,y,L,W,a,b,(tr-0.15-t0)/0.6)
        for i,cl in enumerate(FIN_CL): cl.t0=T5+0.25+i*0.12; cl.draw(fl,SCR,t)
        for p_ in FALL:
            if p_['fg']: continue
            y=(p_['y']+p_['v']*t)%(FH+200)-100; x=p_['x']+30*math.sin(t*0.9+p_['ph'])
            floret(fl,SCR,x,y,p_['s'],p_['sp']*t,p_['c'],1.0,0.85,False)
        fl.comp(img,0.92*eout(tr/0.5),blur=0.8)
    else:
        add(img,particles(t,0.5,(0,-50*t)))
    L=place_M(ch,M)
    add(img,glow(L,22,0.14)); over(img,L)
    fx_=Canvas()
    if T2<=t<T3:   glints(t-T2,M,[(617,1516,0.0),(727,1216,0.45),(680,827,0.25),(470,1240,0.7)],(1,0.93,0.75),fx_)
    elif T3<=t<T4: glints(t-T3,M,[(853,357,0.0),(767,193,0.4),(933,440,0.7),(1095,600,0.2)],(1,0.92,0.7),fx_)
    elif T4<=t<T5: glints(t-T4,M,[(587,444,0.0),(703,444,0.5),(600,580,0.25)],(0.75,0.95,1.0),fx_)
    la=fx_.rgb.astype(np.float32)/255
    img+=la+cv2.GaussianBlur(la,(0,0),6)*1.4
    if fin:
        tr=t-T5
        fg=Canvas()
        for p_ in FALL:
            if not p_['fg']: continue
            y=(p_['y']+p_['v']*1.8*t)%(FH+200)-100; x=p_['x']+40*math.sin(t*0.7+p_['ph'])
            floret(fg,SCR,x,y,p_['s']*2.2,p_['sp']*t,p_['c'],1.0,0.9,False)
        fg.comp(img,0.8*eout(tr/0.6),blur=7)
        spk=Canvas()
        for s_ in OP.SPK:
            k=max(0,math.sin(t*s_['sp']+s_['ph']))**3
            if k>0.02: star4(spk,np.array([s_['x'],s_['y']]),s_['L']*(0.6+0.4*k),tuple(c*k for c in s_['c']))
        la=spk.rgb.astype(np.float32)/255; img+=(la+cv2.GaussianBlur(la,(0,0),5))*eout(tr/0.8)
        fm=frame_layer(tr-0.5); img+=fm[...,None]*FRAME_C*0.95+cv2.GaussianBlur(fm,(0,0),4)[...,None]*np.array(TEAL,np.float32)*0.9
        g=np.clip((_yy-FH*0.68)/(FH*0.32),0,1)[...,None]**1.4
        img*=1-0.74*g*eout(tr/1.2)
        # top emblem: floret in a ring
        ke=eout((tr-1.0)/0.8)
        if ke>0:
            em=Canvas(); C=np.array([FW/2,150])
            em.circle(C,62*ke,PALE,1); em.circle(C,70*ke,TEAL_L,1)
            for k in range(8):
                a=math.radians(45*k+20*tr); p=C+np.array([math.cos(a),math.sin(a)])*70*ke
                d=4*ke; em.poly([p+[0,-d],p+[d,0],p+[0,d],p+[-d,0]],TEAL_L)
            floret(em,SCR,FW/2,150,46*ob((tr-1.0)/0.6),0.25*tr,BLUES[3],1.0,1.1)
            la=em.rgb.astype(np.float32)/255; a=em.a.astype(np.float32)/255
            img[...]=img*(1-a[...,None]*ke)+la*ke; img+=cv2.GaussianBlur(la,(0,0),8)*0.8*ke
        # title
        kt=eout((tr-1.3)/1.1,3)
        if kt>0:
            sp=int((150-110*kt)*0.7)
            band=band_at(text_mask('ANELIA',F_EN,sp),1595)
            col=grad_fill(band,(0.95,1.0,1.0),(0.45,0.88,0.88),(0.80,0.96,1.0))
            img+=cv2.GaussianBlur(band,(0,0),14)[...,None]*np.array(TEAL,np.float32)*0.9*kt
            over(img,np.dstack([col*kt,band*kt]))
            su=(tr-2.5)/0.8
            if 0<su<1:
                sh=np.exp(-((_xx-(-200+su*1480)+(_yy-1595)*0.4)/60)**2)*band
                add(img,sh[...,None]*np.array([0.9,1,1]),0.8)
        kk=eout((tr-1.9)/0.9)
        if kk>0:
            dv=LineLayer(); y=1686; w=260*kk
            dv.line((FW/2-w,y),(FW/2-26,y)); dv.line((FW/2+26,y),(FW/2+w,y)); dv.fill([(FW/2,y-9),(FW/2+9,y),(FW/2,y+9),(FW/2-9,y)])
            m=dv.f(); img+=m[...,None]*FRAME_C+cv2.GaussianBlur(m,(0,0),4)[...,None]*np.array(TEAL,np.float32)
            b1=band_at(text_plain('에피소드 3',F_EP),1736)
            over(img,np.dstack([grad_fill(b1,(0.70,1.0,0.96),(0.40,0.85,0.85),(0.62,0.95,0.95))*kk,b1*kk]))
            k2=eout((tr-2.2)/0.9)
            if k2>0:
                b2=band_at(text_plain('마법은 숨겨지지 않아!',F_KR),1800)
                img+=cv2.GaussianBlur(b2,(0,0),8)[...,None]*np.array([0.3,0.85,0.85],np.float32)*0.5*k2
                over(img,np.dstack([np.ones((FH,FW,3),np.float32)*np.array([0.95,0.99,1.0],np.float32)*(b2*k2)[...,None],b2*k2]))
    fl=flash(t,T2,0.12,1.2)+flash(t,T3,0.07,0.9)+flash(t,T4,0.07,0.9)+flash(t,T5,0.09,1.0)
    img+=fl*np.array([0.80,0.97,1.0],np.float32)
    return to8(img)

if __name__=='__main__':
    only=sys.argv[1:]
    if only:
        for f in map(int,only): Image.fromarray(render(f)).save(S+f'output/an_pv_{f:03d}.png')
        sys.exit()
    out=S+'output/anelia_motion.mp4'
    p=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{FW}x{FH}','-r',str(FPS),'-i','-',
        '-c:v','libx264','-pix_fmt','yuv420p','-crf','15','-preset','slow','-tune','animation','-movflags','+faststart',out],stdin=subprocess.PIPE)
    with mp.get_context('fork').Pool(3) as pool:
        for i,fr in enumerate(pool.imap(render,range(N),chunksize=2)):
            p.stdin.write(fr.tobytes())
            if i%30==0: print(i,flush=True)
    p.stdin.close(); p.wait(); print('done',out)
