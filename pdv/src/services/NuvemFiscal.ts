/**
 * Mock Service - Nuvem Fiscal API (Emissão de NFC-e)
 * Documentação real: https://dev.nuvemfiscal.com.br/docs/
 */

export interface NfceItem {
    codigo: string;
    descricao: string;
    quantidade: number;
    valor_unitario: number;
  }
  
  export interface NfcePayload {
    ambiente: "homologacao" | "producao";
    infNFe: {
      ide: {
        natOp: string;
      };
      emit: {
        cpf_cnpj: string;
      };
      dest?: {
        cpf_cnpj?: string; // NFC-e pode ser anônima
      };
      det: Array<{
        nItem: number;
        prod: NfceItem;
        imposto: {
          icms: { CST: string; orig: string };
        };
      }>;
      pag: {
        detPag: Array<{
          tPag: string; // 17 = PIX, 01 = Dinheiro
          vPag: number;
        }>;
      };
    };
  }
  
  export class NuvemFiscalService {
    private static API_KEY = "mock_key_12345";
    private static BASE_URL = "https://api.nuvemfiscal.com.br/nfe";
  
    /**
     * Envia o carrinho para a Sefaz e retorna o Link do Cupom Fiscal
     */
    static async emitirNFCe(itens: NfceItem[], totalPix: number): Promise<{ url_cupom: string; chave: string }> {
      console.log("[NuvemFiscal] Montando Payload JSON para NFC-e...");
      
      const payload: NfcePayload = {
        ambiente: "homologacao",
        infNFe: {
          ide: { natOp: "Venda Presencial" },
          emit: { cpf_cnpj: "12345678000199" }, // CNPJ da Distribuidora Tailândia
          det: itens.map((item, idx) => ({
            nItem: idx + 1,
            prod: item,
            imposto: {
              icms: { CST: "00", orig: "0" } // Tributação Simplificada
            }
          })),
          pag: {
            detPag: [{ tPag: "17", vPag: totalPix }] // 17 = PIX
          }
        }
      };
  
      console.log("[NuvemFiscal] Enviando POST para SEFAZ...", payload);
      
      // Simula a latência da SEFAZ
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log("[NuvemFiscal] NFC-e Autorizada com Sucesso!");
          resolve({
            chave: "53241012345678000199650010000000011000000001",
            url_cupom: "https://sefaz.df.gov.br/nfce/qrcode?p=53241012345678..."
          });
        }, 800);
      });
    }
  }
  
