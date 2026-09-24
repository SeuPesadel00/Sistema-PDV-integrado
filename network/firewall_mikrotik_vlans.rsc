# MikroTik RouterOS Configuration Script - Rede Distribuidora Tailandia
# Autor: Antigravity IDE (Gemini)
# Objetivo: Provisionamento basico de VLANs, Firewall, NAT, DHCP e Isolamento de CFTV.

/interface bridge
add name=bridge-LAN

# Criação das VLANs na Bridge
/interface vlan
add interface=bridge-LAN name=vlan10-pdv vlan-id=10
add interface=bridge-LAN name=vlan20-gestao vlan-id=20
add interface=bridge-LAN name=vlan25-guest vlan-id=25
add interface=bridge-LAN name=vlan30-cftv vlan-id=30

# Endereçamento IP dos Gateways das VLANs
/ip address
add address=192.168.10.1/24 interface=vlan10-pdv network=192.168.10.0
add address=192.168.20.1/24 interface=vlan20-gestao network=192.168.20.0
add address=192.168.25.1/24 interface=vlan25-guest network=192.168.25.0
add address=192.168.30.1/24 interface=vlan30-cftv network=192.168.30.0

# DHCP Servers para as VLANs (CFTV usa IP estático mas podemos deixar um pool para onboarding de cameras)
/ip pool
add name=pool-vlan10 ranges=192.168.10.50-192.168.10.200
add name=pool-vlan20 ranges=192.168.20.50-192.168.20.200
add name=pool-vlan25 ranges=192.168.25.50-192.168.25.200

/ip dhcp-server
add address-pool=pool-vlan10 interface=vlan10-pdv name=dhcp-vlan10
add address-pool=pool-vlan20 interface=vlan20-gestao name=dhcp-vlan20
add address-pool=pool-vlan25 interface=vlan25-guest name=dhcp-vlan25

/ip dhcp-server network
add address=192.168.10.0/24 dns-server=8.8.8.8,1.1.1.1 gateway=192.168.10.1
add address=192.168.20.0/24 dns-server=8.8.8.8,1.1.1.1 gateway=192.168.20.1
add address=192.168.25.0/24 dns-server=8.8.8.8,1.1.1.1 gateway=192.168.25.1

# NAT (Masquerade para Internet)
/ip firewall nat
add action=masquerade chain=srcnat out-interface=ether1 comment="NAT Principal WAN1 (Fibra)"
add action=masquerade chain=srcnat out-interface=lte1 comment="NAT Failover WAN2 (4G)"

# REGRAS DE FIREWALL - ISOLAMENTO ESTREITO
/ip firewall filter
# 1. Permite acesso ao router em si via LAN (DNS, Ping)
add action=accept chain=input src-address=192.168.0.0/16

# 2. ISOLAMENTO DA VLAN 30 (CFTV)
# Bloqueia as câmeras de acessarem qualquer coisa na internet
add action=drop chain=forward src-address=192.168.30.0/24 out-interface=ether1 comment="Bloqueio WAN para CFTV"
add action=drop chain=forward src-address=192.168.30.0/24 out-interface=lte1 comment="Bloqueio WAN para CFTV"

# Bloqueia as câmeras de abrirem conexões para outras VLANs (elas só respondem a RTSP originado pelo servidor)
add action=drop chain=forward connection-state=new src-address=192.168.30.0/24 dst-address=192.168.10.0/24 comment="Bloqueia CFTV -> PDV/Server"
add action=drop chain=forward connection-state=new src-address=192.168.30.0/24 dst-address=192.168.20.0/24 comment="Bloqueia CFTV -> Gestao"

# 3. Libera o Servidor Local (192.168.10.2) para puxar stream das cameras (RTSP 554)
add action=accept chain=forward src-address=192.168.10.2 dst-address=192.168.30.0/24 port=554 protocol=tcp comment="Permite Servidor Local RTSP"
add action=accept chain=forward src-address=192.168.10.2 dst-address=192.168.30.0/24 port=554 protocol=udp comment="Permite Servidor Local RTSP UDP"

# 4. Libera trafego relacionado e estabelecido entre as VLANs (retorno do RTSP)
add action=accept chain=forward connection-state=established,related

# 5. ISOLAMENTO DO WI-FI VISITANTE (VLAN 25)
add action=drop chain=forward src-address=192.168.25.0/24 dst-address=192.168.10.0/24 comment="Isolamento Guest -> PDV"
add action=drop chain=forward src-address=192.168.25.0/24 dst-address=192.168.20.0/24 comment="Isolamento Guest -> Gestao"
add action=drop chain=forward src-address=192.168.25.0/24 dst-address=192.168.30.0/24 comment="Isolamento Guest -> CFTV"

# Conclusão do Firewall
add action=drop chain=input connection-state=invalid
add action=drop chain=forward connection-state=invalid
